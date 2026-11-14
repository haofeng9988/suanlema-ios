/* 算了吗 · 易币前端助手（游戏大厅专用货币 yibi.js）
 * 统一所有游戏页的易币读写入口 + 全站「支付币种」偏好。
 *
 * 规则（算了吗定）：
 *   · 进游戏可用「易币 或 易币」结算消耗；
 *   · 游戏产出一律为「易币」；
 *   · 找换店 易币 ↔ 易币 双向互兑（当天牌价）。
 *
 * 用法：
 *   Yibi.wallet()                      -> Promise<{ok,yibi,points,per_point,...}>
 *   Yibi.earn(amount, game, reason)    -> Promise<{ok,yibi,added}>   （产出：永远易币）
 *   Yibi.spend(amount, game, reason)   -> Promise<{ok,...}>          （消耗：按当前币种偏好）
 *   Yibi.exchange(amount)              -> 易币→易币
 *   Yibi.buy(points)                   -> 易币→易币
 *   Yibi.rate() / Yibi.log()
 *   Yibi.cur() / Yibi.setCur('yibi'|'points')   // 支付币种偏好（localStorage: yx_cur）
 *   Yibi.mountBadge(el)                -> 渲染「🪙易币 … · 💠易币 …」
 *   Yibi.mountCurrencyBar(el)          -> 渲染币种切换条（易币/易币）
 */
(function (w) {
  var API = w.__YB_API__ || '';
  var CUR_KEY = 'yx_cur';
  // 各游戏单局费用（易币=易币等值）；0=免费
  var GAME_COST = { millionaire: 50, lingtian: 20, wuxing: 20, bagua: 15, guacard: 20, xiuxing: 15, quiz: 0, daxiaoren: 10 };
  // 入场费明细（与后端一致，用于「登录前花费公告」逐项明示）
  // millionaire: 基础入場 50；易學模式 +40；週賽 +140。锦囊另计 30~50/个。
  var GAME_COST_DETAIL = {
    millionaire: { title: '入場費', lines: [
      { k: '天梯挑戰', v: 300 },
      { k: '易學模式', v: 340 },
      { k: '週賽模式', v: 440 },
      { k: '邀請對賽', v: 300 },
      { k: '初一十五大獎賽', v: 500 }
    ], note: '錦囊另計：50/對 · 求教 40 · 觀眾 40 · 換題 50 · 加時 30（易幣）' },
    lingtian:   { title: '道具費', lines: [ { k: '道具', v: '20~80' } ], note: '收穫可兌易幣' },
    wuxing:     { title: '遊玩費', lines: [ { k: '單局', v: 20 } ], note: '消除得分換易幣，單局最高 ~280' },
    bagua:      { title: '提示費', lines: [ { k: '提示', v: '15~30' } ], note: '過關得易幣，三星有獎' },
    guacard:    { title: '抽卡費', lines: [ { k: '單抽', v: 40 }, { k: '十連', v: 360 } ], note: '對戰贏幣 · 押注可虧' },
    xiuxing:    { title: '煉丹費', lines: [ { k: '煉丹', v: 10 } ], note: '掛機/離線收益兌易幣' },
    quiz:       { title: '遊玩費', lines: [ { k: '每日答題', v: 0 } ], note: '全對得易幣（免費）' }
  };
  var GAME_NAME = { millionaire: '天机百万富翁', lingtian: '灵田天机', wuxing: '五行消消乐',
                    bagua: '八卦解谜', guacard: '天机卦卡', xiuxing: '天机修行', quiz: '易学闯关',
                    daxiaoren: '打小人' };
  var PATH2GAME = { '/millionaire': 'millionaire', '/lingtian': 'lingtian', '/wuxing': 'wuxing',
                    '/bagua': 'bagua', '/guacard': 'guacard', '/xiuxing': 'xiuxing',
                    '/daxiaoren': 'daxiaoren' };
  // 2026-11-14：iOS App 用 loadFileURL 加载（file://），与远程站点不同源，
  // localStorage 里没有 yx_tk。原生侧通过 authShimJS 注入 __nativeToken / __ybTok，
  // 这里必须回退到它，否则 file:// 下所有需要登录的请求都拿不到身份。
  function tok() {
    try {
      var t = localStorage.getItem('yx_tk');
      if (t) return t;
    } catch (e) {}
    try {
      if (typeof window.__ybTok === 'function') {
        var n = window.__ybTok();
        if (n) return n;
      }
      if (window.__nativeToken) return window.__nativeToken;
    } catch (e) {}
    return '';
  }
  function H(extra) {
    var h = { 'X-Token': tok() }; if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST', headers: H({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {}), credentials: 'include', cache: 'no-store'
    }).then(function (r) { return r.json().catch(function () { return { ok: false, msg: '服务器繁忙（' + r.status + '）' }; }); })
      .catch(function () { return { ok: false, msg: '网络不稳定，请稍后重试', _net: true }; });
  }
  function get(path) {
    return fetch(API + path, { headers: H(), credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: '服务器繁忙（' + r.status + '）' }; }); })
      .catch(function () { return { ok: false, msg: '网络不稳定，请稍后重试', _net: true }; });
  }
  // ===== 2026-10-29 算了吗：单一货币（易币）。易币暂时下架 =====
  // SINGLE=true 时全站只用易币：币种锁定、易币入口隐藏；后台关掉开关即恢复。
  var SINGLE = true;
  var _readyCbs = [];
  function cur() {
    if (SINGLE) return 'yibi';
    try { var c = localStorage.getItem(CUR_KEY); return c === 'points' ? 'points' : 'yibi'; } catch (e) { return 'yibi'; }
  }
  function setCur(c) {
    if (SINGLE) return 'yibi';
    c = (c === 'points') ? 'points' : 'yibi'; try { localStorage.setItem(CUR_KEY, c); } catch (e) {} return c;
  }
  function fmt(n) { n = Number(n || 0); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var _LAST = { yibi: 0, points: 0 };

  var Yibi = {
    cur: cur,
    setCur: setCur,
    wallet: function () { return get('/api/yibi/wallet').then(function (d) { if (d && d.ok !== false) { _LAST.yibi = d.yibi || 0; _LAST.points = d.points || 0; } return d; }); },
    earn: function (amount, game, reason) {
      return post('/api/yibi/earn', { amount: amount, game: game, reason: reason })
        .then(function (d) { try { if (d && d.yidian && d.yidian.got) YidianDrop.celebrate(d.yidian.got); } catch (e) {} return d; });
    },
    spend: function (amount, game, reason) { return post('/api/yibi/spend', { amount: amount, game: game, reason: reason, currency: cur() }); },
    // 指定币种支付（不影响全局偏好）：currency = 'yibi' | 'points'
    spendAs: function (amount, game, reason, currency) {
      var c = (currency === 'points') ? 'points' : 'yibi';
      return post('/api/yibi/spend', { amount: amount, game: game, reason: reason, currency: c });
    },
    exchange: function (amount) { return post('/api/yibi/exchange', { amount: amount }); },
    buy: function (points) { return post('/api/yibi/buy', { points: points }); },
    rate: function () { return get('/api/yibi/rate'); },
    log: function () { return get('/api/yibi/log'); },
    tickets: function () { return get('/api/yibi/tickets'); },
    ticket: function (game) { return get('/api/yibi/ticket?game=' + encodeURIComponent(game)); },
    // 游玩入场：普通会员每日首玩免费，超出按当前币种扣费。resolve {ok,free,charged,msg}
    enter: function (game, cost) { return post('/api/yibi/enter', { game: game, cost: cost, currency: cur() }); },
    cost: function (game) { return GAME_COST[game] || 0; },
    gameName: function (game) { return GAME_NAME[game] || game; },
    curGame: function () { return PATH2GAME[location.pathname.replace(/\/+$/, '')] || ''; },
    // 行为上报（不做里程碑/不扣费）：Yibi.action(game, n)
    action: function (game, n) { return post('/api/game/action', { game: game || Yibi.curGame(), n: (n == null ? 1 : n) }); },
    // 明示本局花费与奖励 —— 返回给用户看的一行摘要
    summary: function (game) {
      var c = GAME_COST[game] || 0;
      var t = GAME_NAME[game] || game;
      var curName = (cur() === 'points') ? '易币' : '易币';
      return { game: game, name: t, cost: c, cur: cur(), curName: curName,
               payText: c > 0 ? ('本局 ' + c + ' ' + curName) : '免费' };
    },
    fmt: fmt,
    // 统一徽章文案（全站一致）：🪙 易币 X · 💠 易币 Y
    badgeHTML: function (y, p) {
      if (SINGLE) return '🪙 易币 <b>' + fmt(y || 0) + '</b>';
      return '🪙 易币 <b>' + fmt(y || 0) + '</b> · 💠 易币 <b>' + fmt(p || 0) + '</b>';
    },
    isSingle: function () { return SINGLE; },
    onReady: function (cb) { if (typeof cb === 'function') { if (SINGLE === false || Yibi._loaded) cb(); else _readyCbs.push(cb); } },
    // 统一在页面顶部渲染「易币 + 易币」余额小徽章
    mountBadge: function (el) {
      if (!el) return;
      Yibi.wallet().then(function (d) {
        if (!d || d.ok === false) { el.innerHTML = ''; return; }
        el.innerHTML = Yibi.badgeHTML(d.yibi || 0, d.points || 0);
        el.style.cssText += ';display:inline-flex;align-items:center;gap:4px';
      });
    },
    // 币种切换条（进游戏扣费用哪个币）
    mountCurrencyBar: function (el) {
      if (!el) return;
      if (SINGLE) { el.innerHTML = ''; el.style.display = 'none'; return; }
      var render = function () {
        var c = cur();
        el.innerHTML =
          '<span style="font-size:11.5px;color:#a99a78;margin-right:6px">扣费用</span>' +
          '<button type="button" data-c="yibi" class="' + (c === 'yibi' ? 'on' : '') + '">🪙 易币</button>' +
          '<button type="button" data-c="points" class="' + (c === 'points' ? 'on' : '') + '">💠 易币</button>';
        var bs = el.querySelectorAll('button');
        for (var i = 0; i < bs.length; i++) {
          bs[i].onclick = function () { setCur(this.getAttribute('data-c')); render(); };
        }
      };
      render();
    }
  };

  // 通用：把「扣费用（币种切换）+ 音效开关」渲染进某个容器（供各游戏菜单复用）
  Yibi.mountSettings = function (container, opt) {
    opt = opt || {};
    if (!container) return;
    if (container.querySelector('[data-yb-settings]')) return;
    var wrap = document.createElement('div');
    wrap.setAttribute('data-yb-settings', '1');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:8px';
    // 扣费用：币种切换
    var fee = document.createElement('div');
    fee.style.cssText = 'display:flex;flex-direction:column;gap:6px;background:var(--c1,#2a2218);' +
      'border:1px solid var(--c2,#3a2e1e);border-radius:10px;padding:11px 14px';
    fee.innerHTML = '<div style="font-size:13px;color:#a99a78;font-weight:700">扣费用（本局用哪种币结算）</div>';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:6px';
    fee.appendChild(bar);
    var st = document.createElement('style');
    st.textContent = '[data-yb-settings] button[data-c]{padding:7px 12px;border-radius:9px;border:1px solid #2e2618;' +
      'background:#1e1810;color:#a99a78;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}' +
      '[data-yb-settings] button[data-c].on{background:linear-gradient(135deg,#8a6a24,#c9922f);color:#fff;border-color:#d4af37}';
    document.head.appendChild(st);
    wrap.appendChild(fee);
    // 音效开关
    var sfxSlot = document.createElement('div');
    wrap.appendChild(sfxSlot);
    container.appendChild(wrap);
    Yibi.mountCurrencyBar(bar);
    if (window.SFX && SFX._renderToggleInline) { try { SFX._renderToggleInline(sfxSlot); } catch (e) {} }
  };

  // ===== 游戏内「⚙ 设置」浮钮（扣费用 + 音效开关，取代原左下角扣费浮条 / 右下角音效浮钮）=====
  function isGamePage() {
    return /^\/(millionaire|lingtian|wuxing|bagua|guacard|xiuxing)$/.test(location.pathname.replace(/\/+$/, ''));
  }
  Yibi.openSettings = function () {
    var old = document.getElementById('__yb_setting_modal__');
    if (old) old.parentNode.removeChild(old);
    var mask = document.createElement('div');
    mask.id = '__yb_setting_modal__';
    mask.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.7);display:flex;' +
      'align-items:flex-end;justify-content:center;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    var panel = document.createElement('div');
    panel.style.cssText = 'width:100%;max-width:440px;background:linear-gradient(160deg,#241d10,#171208);' +
      'border:1px solid rgba(212,175,55,.5);border-radius:18px 18px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom))';
    panel.innerHTML = '<div style="font-size:17px;font-weight:900;color:#f5d06f;letter-spacing:1px;margin-bottom:4px">⚙ 游戏设置</div>' +
      '<div style="font-size:12px;color:#a99a78;margin-bottom:12px">扣费用 · 音效</div>';
    var slot = document.createElement('div');
    panel.appendChild(slot);
    var close = document.createElement('button');
    close.textContent = '关闭';
    close.style.cssText = 'width:100%;margin-top:14px;padding:11px;border-radius:10px;border:1px solid #2e2618;' +
      'background:#1e1810;color:#a99a78;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit';
    close.onclick = function () { mask.parentNode && mask.parentNode.removeChild(mask); };
    panel.appendChild(close);
    mask.appendChild(panel);
    mask.addEventListener('click', function (e) { if (e.target === mask) close.onclick(); });
    document.body.appendChild(mask);
    Yibi.mountSettings(slot);
  };
  function injectSettingsButton() {
    try {
      if (!isGamePage()) return;
      if (w.__NO_YB_SETBTN__) return;
      if (document.getElementById('__yb_setbtn__')) return;
      var st = document.createElement('style');
      st.textContent = '#__yb_setbtn__{position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 54px);z-index:9997;' +
        'width:40px;height:40px;border-radius:50%;background:rgba(26,22,18,.85);border:1px solid rgba(212,175,55,.55);' +
        'color:#d4af37;font-size:19px;line-height:38px;text-align:center;cursor:pointer;user-select:none;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.5);backdrop-filter:blur(4px)}#__yb_setbtn__:active{transform:scale(.9)}';
      document.head.appendChild(st);
      var b = document.createElement('button');
      b.id = '__yb_setbtn__';
      b.type = 'button';
      b.title = '游戏设置';
      b.innerHTML = '⚙';
      b.addEventListener('click', function (e) { e.stopPropagation(); Yibi.openSettings(); });
      document.body.appendChild(b);
    } catch (e) {}
  }

  // 自动注入：游戏页挂「⚙ 设置」浮钮；不再注入左下角扣费浮条
  function autoBar() {
    injectSettingsButton();
  }

  // ===== 入场确认弹窗：进入游戏前明示「花多少易币/易币、能得到什么」=====
  // Yibi.entryGate(game, {onGo}) -> 展示确认；确认后允许继续（不在此扣费，扣费由游戏/后端守卫）
  Yibi.entryGate = function (game, opt) {
    opt = opt || {};
    var cost = GAME_COST[game] || 0;
    var name = GAME_NAME[game] || game;
    var reward = opt.reward || '';
    Promise.all([
      Yibi.ticket(game).catch(function () { return {}; }),
      Yibi.wallet().catch(function () { return {}; })
    ]).then(function (arr) {
      var t = arr[0] || {}, wal = arr[1] || {};
      var isVip = !!t.is_vip, freeRemain = (t.free_remain == null ? 0 : t.free_remain);
      var free = !opt.needLogin && (isVip || freeRemain > 0);
      var balY = Number(wal.yibi || 0), balP = Number(wal.points || 0);
      // 汇率：1 易币 = mult 易币（易币更值钱）→ 易币价 = ceil(易币价 / mult)
      var mult = Math.max(1, Number(wal.points_multiplier || 5));
      function ptsOf(y) { return y <= 0 ? 0 : Math.max(1, Math.ceil(y / mult)); }
      var costP = ptsOf(cost);
      function enough(cur) {
        if (isVip || free || cost <= 0) return true;
        return (cur === 'points' ? balP : balY) >= (cur === 'points' ? costP : cost);
      }
      // 两币种花费行（都列出，明示各花多少）
      function feeRows() {
        if (cost <= 0) {
          return '<div style="color:#7bd88a;font-weight:900;font-size:15px">本局免费</div>';
        }
        if (isVip) {
          return '<div style="color:#ffd989;font-weight:900;font-size:15px">👑 会员免费（VIP 不限次）</div>';
        }
        var det = GAME_COST_DETAIL[game] || null;
        var head = free ? '<div style="color:#7bd88a;font-weight:800;margin-bottom:6px">🎉 今日首玩免费（之后按下表扣费）</div>' : '';
        var rows = '';
        if (det) {
          rows += '<div style="color:#a99a78;font-size:12px;margin:2px 0 3px">'+det.title+'</div>';
          det.lines.forEach(function (ln) {
            rows +=
              '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0">' +
                '<span>'+ln.k+'</span><span style="color:#ffe9a8;font-weight:800">'+ln.v+'</span>' +
              '</div>';
          });
          if (det.note) rows += '<div style="color:#8a7c5c;font-size:11.5px;margin-top:3px;line-height:1.5">'+det.note+'</div>';
        }
        // 2026-11-15 老板定案：百万富翁各模式入场费以服务端 entry_fee_of() 为准
        // （天梯/邀请 300、易学 340、周赛 440）。入口弹窗不再单列「用易币 X」，
        // 只保留易币余额，避免与真实扣费不一致。
        if (game === 'millionaire') {
          rows +=
            '<div style="margin-top:7px;padding-top:7px;border-top:1px dashed rgba(212,175,55,.3);display:flex;justify-content:space-between;align-items:center;padding:5px 0">' +
              '<span>🪙 易币余额</span>' +
              '<span style="color:#8a7c5c;font-size:12px">' + balY + '</span>' +
            '</div>';
          return head + rows;
        }
        // 2026-11-04 单一货币：其他游戏只显示易币花费
        rows +=
          '<div style="margin-top:7px;padding-top:7px;border-top:1px dashed rgba(212,175,55,.3);display:flex;justify-content:space-between;align-items:center;padding:5px 0">' +
            '<span>🪙 用易币 <b style="color:#f5d06f">' + cost + '</b></span>' +
            '<span style="color:#8a7c5c;font-size:12px">余额 ' + balY + (balY < cost && !free ? ' <b style="color:#e0644f">不足</b>' : '') + '</span>' +
          '</div>';
        return head + rows;
      }
      var cbtn = '';  // 2026-11-04 单一货币：不再提供币种切换
      var mask = document.createElement('div');
      mask.id = '__yb_entry__';
      mask.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      mask.innerHTML =
        '<div style="width:100%;max-width:300px;background:linear-gradient(160deg,#241d10,#171208);border:1px solid rgba(212,175,55,.5);border-radius:14px;padding:14px 14px;box-shadow:0 10px 40px rgba(0,0,0,.6)">' +
        '<div style="font-size:16px;font-weight:900;color:#f5d06f;margin-bottom:2px">' + name + '</div>' +
        '<div style="font-size:11.5px;color:#a99a78;line-height:1.6">进游戏前请确认本局花费与奖励' + (opt.needLogin ? ' · <span style="color:#e0b25c">未登入（餘額以登入後為準）</span>' : '') + '</div>' +
        '<div style="margin-top:9px;background:rgba(0,0,0,.3);border:1px solid rgba(212,175,55,.3);border-radius:10px;padding:9px 11px;font-size:12.5px;color:#e8dcc8;line-height:1.7">' +
        '💳 本局花费：' +
        '<div style="margin-top:3px">' + feeRows() + '</div>' +
        (reward ? '<div style="margin-top:5px">🎁 可得奖励：<b style="color:#ffe9a8">' + reward + '</b></div>' : '') +
        '<div style="margin-top:1px">🪙 产出一律为易币</div>' +
        '</div>' + cbtn +
        '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<button id="__yb_cancel" style="flex:1;padding:9px;border-radius:9px;border:1px solid #2e2618;background:#1e1810;color:#a99a78;font-size:13px;font-weight:800;font-family:inherit">返回</button>' +
        '<button id="__yb_go" style="flex:1.6;padding:9px;border-radius:9px;border:none;background:linear-gradient(135deg,#8a6a24,#c9922f);color:#fff;font-size:13px;font-weight:900;font-family:inherit">' + (opt.needLogin ? '🔑 登入並開始' : '开始游戏') + '</button>' +
        '</div></div>';
      var stl = document.createElement('style');
      stl.textContent = '#__yb_entry__ button{cursor:pointer;font-family:inherit}#__yb_entry__ button.on{background:linear-gradient(135deg,#8a6a24,#c9922f);color:#fff;border-color:#d4af37}';
      document.head.appendChild(stl);
      document.body.appendChild(mask);
      // 2026-11-04 单一货币：无币种切换
      mask.querySelector('#__yb_cancel').onclick = function () { document.body.removeChild(mask); };
      mask.querySelector('#__yb_go').onclick = function () { document.body.removeChild(mask); (opt.onGo || function () {})(); };
    });
  };

  // ===== 门票门控（每次进入页面前后只收一次）=====
  // 返回 Promise<bool>：true=允许继续。普通会员每日首玩免费，超出按当前币种收费。
  // 同一次页面访问内只触发一次（避免每关/每步都扣）。
  w.__yb_gate = w.__yb_gate || {};
  Yibi.gateOnce = function (game, cost) {
    if (w.__yb_gate[game]) return Promise.resolve(true);
    if (!tok()) { return Promise.resolve(true); } // 未登录交给页面自己处理
    if (!Yibi.enter) { w.__yb_gate[game] = 1; return Promise.resolve(true); }
    return Yibi.enter(game, (cost == null ? (GAME_COST[game] || 0) : cost)).then(function (r) {
      if (r && r.ok === false) { return false; }
      w.__yb_gate[game] = 1;
      try { if (r && r.msg) { if (w.__yb_toast) w.__yb_toast(r.msg); } } catch (e) {}
      return true;
    });
  };

  // ===== 一键进入游戏：先弹确认（明示花费/奖励）→ 跳转 =====
  // 真正的扣费在各游戏开局时由 Yibi.enter / 后端 enter_game 执行，避免重复扣费
  // 未登录也弹公告（让访客先看清易币/易币花费），点「登入并开始」再去登录
  // ===== 断网兜底（2026-11-14）：包内自带本地游戏文件，断网也能玩 =====
  // 只在这 4 款在包内有完整离线副本（不依赖任何网络接口）：
  //   五行消消乐 / 天机卦卡 / 天机修行 / 八卦解谜
  // 其余（百万富翁、灵田、闯关、市集、矿场）必须联网，断网时明确提示，不做假兜底。
  var YB_LOCAL_GAMES = {
    wuxing:  '../wuxing-match.html',
    guacard: '../gua-card.html',
    xiuxing: '../xiuxing.html',
    bagua:   '../bagua-puzzle.html'
  };

  function ybIsOnline() {
    try { return navigator.onLine !== false; } catch (e) { return true; }
  }

  function ybToast(msg) {
    try {
      if (w.__yb_toast) { w.__yb_toast(msg, 3200); return; }
    } catch (e) {}
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:9999;' +
        'background:rgba(20,15,8,.95);color:#f5e6c8;border:1px solid rgba(212,175,55,.55);' +
        'border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;line-height:1.5;' +
        'max-width:80%;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.55)';
      d.textContent = msg;
      document.body.appendChild(d);
      setTimeout(function () { try { document.body.removeChild(d); } catch (e) {} }, 3200);
    } catch (e) {}
  }

  // 解析最终要跳的地址：在线→远程（保留易币/榜单等完整功能），离线→包内本地文件
  Yibi.resolveGameUrl = function (game, url) {
    var online = ybIsOnline();
    var local = YB_LOCAL_GAMES[game];
    if (!online && local) { return { url: local, offline: true }; }
    if (!online && !local) { return { url: '', offline: true, blocked: true }; }
    return { url: url, offline: false };
  };

  Yibi.gotoGame = function (game, url, reward) {
    var loggedIn = !!tok();
    Yibi.entryGate(game, {
      reward: reward,
      needLogin: !loggedIn,
      onGo: function () {
        if (!loggedIn) {
          // 2026-11-14：离线时跳远程登录页必然打不开，直接明确提示，避免白屏
          if (!ybIsOnline()) { ybToast('📶 目前離線，請先連網登入後再玩'); return; }
          location.href = 'https://tianji.matetechhk.com/index.html#me';
          return;
        }
        var r = Yibi.resolveGameUrl(game, url);
        if (r.blocked) {
          ybToast('📶 此遊戲需聯網遊玩，請恢復網絡後再進入');
          return;
        }
        if (r.offline) { ybToast('📶 目前離線 · 已切換本地模式'); }
        location.href = r.url;
      }
    });
  };

  // ===== 全局计时（自动心跳）Yibi.timer =====
  // 页面可见时每 18s 上报一次 POST /api/game/heartbeat {game, delta_sec}；
  // 切后台（visibilityState==='hidden'）暂停计时；离开页面（unload）用 sendBeacon 补最后一次；
  // 心跳响应里的新里程碑 → 触发全局庆祝弹卡 RewardCeleb.show(list)。失败一律静默，绝不打扰游戏。
  (function () {
    var HEARTBEAT_MS = 18000;   // 上报间隔
    var CAP = 30;               // 单次 delta_sec 封顶（与后端一致）
    var lastTick = Date.now();
    var pending = 0;            // 距上次上报的可见秒数
    var lastReport = Date.now();
    var timer = null;
    var game = '';

    function nowSec() { return Date.now() / 1000; }
    function visible() { try { return document.visibilityState !== 'hidden'; } catch (e) { return true; } }
    function curGame() {
      try { if (typeof Yibi.curGame === 'function') return Yibi.curGame() || ''; } catch (e) {}
      return '';
    }
    // 结算累计可见秒数（封顶）
    function accrue() {
      var t = nowSec();
      var dt = t - lastTick;
      lastTick = t;
      if (dt < 0) dt = 0;
      if (!visible()) return;          // 后台不计时
      pending += dt;
      if (pending > CAP) pending = CAP; // 封顶，避免一次跳报超大值
    }
    function payload(sec) {
      return { game: game, delta_sec: sec };
    }
    function handleResp(d) {
      try {
        if (d && d.milestones && d.milestones.length &&
            w.RewardCeleb && typeof w.RewardCeleb.show === 'function') {
          w.RewardCeleb.show(d.milestones);
        }
      } catch (e) {}
    }
    function fire(beacon) {
      accrue();
      var sec = Math.round(pending);
      if (sec <= 0) return;
      pending = 0;
      lastReport = nowSec();
      if (!game) game = curGame();
      if (beacon) {
        // 离开页面：sendBeacon 不保证带自定义头 → token 放 query 参，兼容 notify.js 的登录门禁
        try {
          var q = '/api/game/heartbeat?game=' + encodeURIComponent(game) +
                  '&delta_sec=' + sec + '&token=' + encodeURIComponent(tok());
          var okBeacon = false;
          try {
            if (navigator.sendBeacon) {
              var blob = new Blob([JSON.stringify(payload(sec))], { type: 'application/json' });
              okBeacon = navigator.sendBeacon(q, blob);
            }
          } catch (e) { okBeacon = false; }
          if (!okBeacon) {
            // 退路：同步无凭据请求（回调不阻塞页面卸载）
            try { if (navigator.sendBeacon) navigator.sendBeacon(q); } catch (e2) {}
          }
        } catch (e) {}
        return;
      }
      post('/api/game/heartbeat', payload(sec)).then(handleResp).catch(function () {});
    }
    function tick() { fire(false); }

    function start() {
      if (timer) return;
      try { game = curGame(); } catch (e) { game = ''; }
      lastTick = Date.now(); lastReport = Date.now();
      timer = setInterval(function () {
        if (!visible()) { lastTick = nowSec(); return; }  // 后台：不累计
        tick();
      }, HEARTBEAT_MS);
      // 切回前台时立刻结算一次（补上刚才可见但未满一轮的时间）
      document.addEventListener('visibilitychange', function () {
        lastTick = nowSec();          // 重置基准，hidden 期间不计时
        if (visible()) { accrue(); }  // 归来时只结算当前这一瞬
      });
      window.addEventListener('pagehide', function () { fire(true); });
      window.addEventListener('beforeunload', function () { fire(true); });
      window.addEventListener('unload', function () { fire(true); });
      // 页面重新可见后，若离线很久，补报一次
      window.addEventListener('focus', function () { lastTick = nowSec(); });
    }

    Yibi.timer = {
      start: start,
      stop: function () { if (timer) { clearInterval(timer); timer = null; } },
      report: function () { fire(false); },
      flush: function () { fire(true); },
      game: function () { return game; },
      _pending: function () { return pending; }
    };

    // 仅有 token 时自动开启（未登录静默跳过，避免无谓 401）
    function autoStart() {
      try { if (location.protocol === 'file:') return; } catch (e) {}  // iOS App file:// 内置副本：不上报
      try { if (!tok()) return; } catch (e) { return; }
      if (!Yibi.curGame()) return;   // 非游戏页不启动
      start();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart);
    else autoStart();
  })();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBar);
  else autoBar();

  // 自动引入庆祝弹卡组件（RewardCeleb）——所有已引入 yibi.js 的游戏页自动获得
  (function () {
    try {
      if (w.RewardCeleb || w.__rwUiLoading) return;
      w.__rwUiLoading = 1;
      var s = document.createElement('script');
      s.src = '/reward-ui.js?v=20261007';
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  })();

  /* ==================== 云存档双保险（GameSave） ====================
   * 本地优先 + 云端自动同步。契约：deliverables/游戏存档双保险-施工契约.md
   *   GameSave.bind(game, {read, write, merge})  载入即同步（登录态）
   *   GameSave.markDirty()                        状态变动后调用（防抖上传）
   * 硬闸：① file://（iOS App 内置副本）→ 完全空转；② 未登录 → 完全空转。
   * 两者任一成立：不发任何请求、不改任何行为（保障过审 App 安全）。
   */
  var GameSave = (function () {
    var GAMES = { wuxing: 1, lingtian: 1, millionaire: 1, guacard: 1, xiuxing: 1, bagua: 1, quiz: 1 };
    var DEBOUNCE_MS = 3000;
    var st = { game: '', read: null, write: null, merge: null, ts: 0, timer: 0, bound: false };

    // ── 硬闸：只按登录态判定 ──
    // 2026-11-14 变更：原先另有「file:// 一律空转」的硬闸，导致 iOS App 内
    // 云存档完全失效（服务端接口本身正常）。iOS 用 loadFileURL 加载，协议必然是
    // file:，但请求经原生 URLSession 转发，能正常到达后端 → 该闸必须去掉。
    // 未登录仍然完全空转（不发任何请求）。
    function disabled() { return !tok(); }

    function nowTs() { return Date.now(); }

    // 默认合并：dict 递归 / 数值取 max / 数组去重合并 / 其余取新
    // 跨天保护：日期戳不同 → 对应「当日计数器」取较新方（b），禁止 max 跨天累加
    var DAY_PAIRS = [['paceDay','paceCount'],['yibiDailyDate','yibiEarnedToday']];
    // 时间戳配对字段：以时间戳较新方为准（体力等消耗型资源不可 max）
    var TS_PAIRS = [['staTs','sta']];
    function deepMerge(a, b) {
      if (b === undefined || b === null) return a;
      if (a === undefined || a === null) return b;
      if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
      if (Array.isArray(a) && Array.isArray(b)) {
        var out = a.slice();
        for (var i = 0; i < b.length; i++) {
          var found = false;
          for (var j = 0; j < out.length; j++) {
            if (JSON.stringify(out[j]) === JSON.stringify(b[i])) { found = true; break; }
          }
          if (!found) out.push(b[i]);
        }
        return out;
      }
      if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        var r = {}, k;
        for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) r[k] = a[k];
        for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) r[k] = deepMerge(a[k], b[k]);
        // 时间戳配对：以时间戳较新方为准（体力等消耗型资源不可 max）
        for (var ti = 0; ti < TS_PAIRS.length; ti++) {
          var ttk = TS_PAIRS[ti][0], tvk = TS_PAIRS[ti][1];
          var tot = a[ttk], tnt = b[ttk];
          if (tot === undefined && tnt === undefined) continue;
          if (tot !== undefined && tnt !== undefined) {
            var tnv = (Number(tnt)||0) >= (Number(tot)||0);
            r[ttk] = tnv ? tnt : tot;
            r[tvk] = tnv ? (b[tvk] !== undefined ? b[tvk] : a[tvk]) : a[tvk];
          } else {
            var tsrc = (tnt !== undefined) ? b : a;
            r[ttk] = tsrc[ttk]; r[tvk] = tsrc[tvk];
          }
        }
        // 跨天：日期戳较新一方决定「当日计数器」；非今天则归零（禁止 max 跨天累加）
        var _td = new Date(); var _tds = _td.getFullYear()+'-'+('0'+(_td.getMonth()+1)).slice(-2)+'-'+('0'+_td.getDate()).slice(-2);
        for (var p = 0; p < DAY_PAIRS.length; p++) {
          var dk = DAY_PAIRS[p][0], ck = DAY_PAIRS[p][1];
          var ld = a[dk], cd = (b[dk] !== undefined ? b[dk] : ld);
          if (ld === undefined && cd === undefined) continue;
          var stamp, cnt;
          if (ld !== undefined && cd !== undefined && String(ld) === String(cd)) {
            stamp = ld; cnt = Math.max(Number(a[ck]||0), Number(b[ck]||0));   // 同日取 max
          } else {
            var cloudNewer = String(cd||'') >= String(ld||'');
            stamp = cloudNewer ? cd : ld;
            cnt = cloudNewer ? (b[ck] !== undefined ? b[ck] : a[ck]) : a[ck];
          }
          if (String(stamp||'') === _tds) { r[dk] = stamp; r[ck] = (cnt||0); }
          else { r[dk] = _tds; r[ck] = 0; }
        }
        return r;
      }
      return b;   // 字符串/布尔/类型不一致 → 取新（云端）
    }

    function save(game, data) {
      if (disabled() || !GAMES[game]) return Promise.resolve(null);
      var ts = nowTs(); st.ts = ts;
      return post('/api/game/save', { game: game, data: data, client_ts: ts })
        .then(function (r) { return r; })
        .catch(function () { return null; });
    }

    // 防抖上传（最多重试 2 次）
    function markDirty() {
      if (disabled() || !st.bound || !st.read) return;
      try { st.ts = nowTs(); } catch (e) {}
      if (st.timer) clearTimeout(st.timer);
      st.timer = setTimeout(function () { flush(0); }, DEBOUNCE_MS);
    }

    function flush(retry) {
      if (disabled() || !st.bound || !st.read) return;
      var data;
      try { data = st.read(); } catch (e) { return; }
      if (!data || typeof data !== 'object') return;
      save(st.game, data).then(function (r) {
        if (!r || r.ok === false) { if (retry < 2) setTimeout(function () { flush(retry + 1); }, 2000 * (retry + 1)); }
      });
    }

    // 判断对象是否有「实质内容」（防止空/全0的默认存档污染云端）
    function hasContent(o) {
      if (!o || typeof o !== 'object') return false;
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        var v = o[k];
        if (typeof v === 'number') { if (v > 0) return true; }
        else if (typeof v === 'boolean') { if (v) return true; }
        else if (typeof v === 'string') { if (v) return true; }
        else if (v && typeof v === 'object') { if (Object.keys(v).length) return true; }
      }
      return false;
    }
    function sameContent(a, b) {
      try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
    }

    // 立即同步一次（登录态）：云端有档→merge 回本地；本地有、云端无→迁移上云
    function bind(game, opts) {
      if (!GAMES[game]) return Promise.resolve(null);
      opts = opts || {};
      st.game = game; st.read = opts.read || null; st.write = opts.write || null;
      st.merge = opts.merge || deepMerge; st.bound = true;
      if (!tok()) { st.bound = false; return Promise.resolve(null); }   // 未登录：空转

      var local = {};
      try { local = (st.read && st.read()) || {}; } catch (e) { local = {}; }

      return get('/api/game/load?game=' + encodeURIComponent(game)).then(function (d) {
        if (d && d.ok && d.data && typeof d.data === 'object') {
          var merged;
          try { merged = st.merge(local, d.data); } catch (e) { merged = deepMerge(local, d.data); }
          try { st.write && st.write(merged); } catch (e) {}
          // 合并后若本地更丰富（老手机旧进度被拉平），回推上云防止云端落后
          if (hasContent(local) && !sameContent(merged, d.data)) { save(game, merged); }
          return { loaded: true, source: 'cloud', merged: merged };
        }
        // 云端无档：把本地迁上云 —— ⚠️ 仅当本地「有实质内容」才上传，防止空机/默认0污染云端
        if (hasContent(local)) { save(game, local); return { loaded: false, source: 'local', migrated: true }; }
        return { loaded: false, source: 'none', emptyLocal: true };
      }).catch(function () { return { loaded: false, source: 'error' }; });
    }

    // 页面隐藏/关闭补发（sendBeacon）
    function beaconFlush() {
      if (disabled() || !st.bound || !st.read) return;
      try {
        var data = st.read();
        if (!data || typeof data !== 'object') return;
        var body = JSON.stringify({ game: st.game, data: data, client_ts: nowTs() });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/game/save', new Blob([body], { type: 'application/json' }));
        }
      } catch (e) {}
    }

    try {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') beaconFlush(); });
      window.addEventListener('pagehide', beaconFlush);
    } catch (e) {}

    return { bind: bind, markDirty: markDirty, flush: function () { flush(2); }, beaconFlush: beaconFlush,
             merge: deepMerge, isDisabled: disabled };
  })();
  Yibi.save = GameSave;
  w.GameSave = GameSave;

  w.Yibi = Yibi;

  /* ===== 易点掉落 · 大提示（2026-10-29 算了吗：要有大大的提示）===== */
  var YidianDrop = {
    celebrate: function (n) {
      n = Number(n || 0); if (n <= 0) return;
      var old = document.getElementById('ydBigDrop'); if (old && old.parentNode) old.parentNode.removeChild(old);
      var box = document.createElement('div');
      box.id = 'ydBigDrop';
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.78);backdrop-filter:blur(6px);animation:ydFade .25s ease';
      var inner = document.createElement('div');
      inner.style.cssText = 'position:relative;width:min(88vw,420px);padding:34px 24px 26px;border-radius:22px;text-align:center;' +
        'background:linear-gradient(160deg,#3a2408,#1c1003 60%);border:2px solid rgba(255,210,90,.75);' +
        'box-shadow:0 0 60px rgba(255,190,60,.55),inset 0 0 40px rgba(255,190,60,.14);' +
        'animation:ydPop .45s cubic-bezier(.2,1.5,.4,1)';
      inner.innerHTML =
        '<div style="font-size:52px;line-height:1;filter:drop-shadow(0 0 12px rgba(255,200,80,.8))">🎋</div>' +
        '<div style="margin-top:10px;font-size:15px;letter-spacing:6px;color:#ffd777;font-weight:800">朔 望 有 得</div>' +
        '<div style="margin:14px 0 4px;font-size:64px;font-weight:900;line-height:1;' +
        'background:linear-gradient(180deg,#fff6d8,#ffc93c 60%,#e89b12);-webkit-background-clip:text;background-clip:text;' +
        'color:transparent;filter:drop-shadow(0 3px 10px rgba(255,180,40,.6))">+' + n + '</div>' +
        '<div style="font-size:17px;font-weight:900;color:#ffe9c0;letter-spacing:2px">易 点</div>' +
        '<div style="margin-top:14px;font-size:12.5px;line-height:1.8;color:#c8b48a">' +
          '初一十五打游戏才有 · 每天最多 5 点<br>去角色页 <b style="color:#ffd777">＋</b> 加到属性上，永久生效</div>' +
        '<button id="ydBigGo" style="margin-top:18px;width:100%;padding:13px;border-radius:12px;border:none;' +
          'background:linear-gradient(135deg,#f5d06f,#c9a227);color:#2a1206;font-size:15px;font-weight:900;' +
          'font-family:inherit;cursor:pointer">去加点 →</button>' +
        '<div id="ydBigClose" style="margin-top:12px;font-size:12px;color:#8a7a58;cursor:pointer">稍后再说</div>' +
        '<style>@keyframes ydFade{from{opacity:0}to{opacity:1}}' +
        '@keyframes ydPop{0%{transform:scale(.6) rotate(-6deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}</style>';
      box.appendChild(inner);
      document.body.appendChild(box);
      function close() { if (box.parentNode) box.parentNode.removeChild(box); }
      inner.querySelector('#ydBigGo').onclick = function () { close(); location.href = 'https://tianji.matetechhk.com/char'; };
      inner.querySelector('#ydBigClose').onclick = close;
      box.onclick = function (ev) { if (ev.target === box) close(); };
      try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (e) {}
    }
  };
  Yibi.yidianCelebrate = YidianDrop.celebrate;
  w.YidianDrop = YidianDrop;
})(window);
