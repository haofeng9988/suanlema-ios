/* 算了吗 · 扣费通知组件 notify.js
 * 昊峯大师要求：会员每次使用工具「成功扣费」后，要弹出扣费通知。
 * 实现：后端在扣费成功时通过响应头 X-Tool-Charge（base64 JSON）下发；
 *       本脚本统一包裹 fetch，读取该头并弹出通知（积分/金币/黑卡次数）。
 * 与 ShareInvite/tool-gate 无耦合，任何工具页只要引入本文件即生效。
 */
(function (global) {
  'use strict';

  if (global.__chargeNotifyLoaded) return;
  global.__chargeNotifyLoaded = true;

  function decodeHeader(v) {
    if (!v) return null;
    try {
      var s = decodeURIComponent(escape(atob(v)));
      return JSON.parse(s);
    } catch (e) {
      try { return JSON.parse(atob(v)); } catch (e2) { return null; }
    }
  }

  function ensureStyle() {
    if (document.getElementById('cn-style')) return;
    var st = document.createElement('style');
    st.id = 'cn-style';
    st.textContent =
      '#cnWrap{position:fixed;left:0;right:0;bottom:22px;z-index:100000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}' +
      '.cn-toast{pointer-events:auto;max-width:88vw;background:linear-gradient(180deg,#2a2114,#1d1710);border:1px solid #d4af37;border-radius:12px;' +
      'color:#f0e6d2;padding:11px 15px;font-size:13.5px;line-height:1.5;box-shadow:0 8px 26px rgba(0,0,0,.55);' +
      'display:flex;align-items:center;gap:9px;transform:translateY(14px);opacity:0;transition:all .28s ease}' +
      '.cn-toast.cn-show{transform:none;opacity:1}' +
      '.cn-toast .cn-ic{font-size:19px;flex:0 0 auto}' +
      '.cn-toast b{color:#d4af37}' +
      '.cn-toast .cn-sub{display:block;font-size:11.5px;color:#a99a78;margin-top:2px}';
    document.head.appendChild(st);
  }

  function show(payload) {
    if (!payload || !payload.type) return;
    var wrap = document.getElementById('cnWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cnWrap';
      document.body.appendChild(wrap);
    }
    ensureStyle();
    var type = payload.type;
    var unit = payload.unit || '';
    var amount = payload.amount;
    var tool = payload.name || payload.tool || '工具';
    var ic = '✅', title = '';
    if (type === 'points') {
      ic = '🪙'; title = '已成功扣费 <b>' + amount + ' 积分</b>';
    } else if (type === 'coins') {
      ic = '💰'; title = '已成功扣费 <b>' + amount + ' 金币</b>';
    } else if (type === 'black') {
      ic = '🖤'; title = '已使用黑卡免费次数 <b>' + amount + ' 次</b>';
    } else {
      ic = '✅'; title = '本次消费 <b>' + amount + ' ' + unit + '</b>';
    }
    var el = document.createElement('div');
    el.className = 'cn-toast';
    el.innerHTML = '<span class="cn-ic">' + ic + '</span><span>' + title +
      '<span class="cn-sub">' + tool + ' · 扣费成功</span></span>';
    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('cn-show'); });
    setTimeout(function () {
      el.classList.remove('cn-show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 3600);
  }

  global.ChargeNotify = { show: show };

  // ===== 登录门禁：昊峯大师要求「所有工具都需登录才能使用」 =====
  // 未登录时弹出一个「登录界面」弹层（不依赖 alert，App 内也能看到），
  // 可直接输入账号密码登录，成功后自动重载当前页继续使用。
  var _realAlert = global.alert;
  var _gateActive = false;
  var _alertTimer = null;
  function _suppressAlert(ms) {
    try { global.alert = function () {}; } catch (e) {}
    try { clearTimeout(_alertTimer); } catch (e) {}
    _alertTimer = setTimeout(function () {
      try { global.alert = _realAlert; } catch (e) {}
    }, ms);
  }
  function _ensureGateStyle() {
    if (document.getElementById('lg-style')) return;
    var st = document.createElement('style');
    st.id = 'lg-style';
    st.textContent =
      '#lgGate{position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.72);backdrop-filter:blur(2px);' +
        'display:flex;align-items:center;justify-content:center;padding:20px;animation:lgFade .18s ease}' +
      '@keyframes lgFade{from{opacity:0}to{opacity:1}}' +
      '.lg-box{width:340px;max-width:92vw;background:linear-gradient(180deg,#241d10,#191309);border:1.5px solid #d4af37;' +
        'border-radius:16px;padding:20px 18px 18px;color:#f0e6d2;box-shadow:0 16px 44px rgba(0,0,0,.6);font-size:14px}' +
      '.lg-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}' +
      '.lg-head .lg-ic{font-size:20px}.lg-head b{color:#d4af37;font-size:15px;flex:1}' +
      '.lg-x{background:transparent;border:1px solid #4a3f28;color:#a99a78;width:28px;height:28px;border-radius:50%;' +
        'font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.lg-title{font-size:18px;color:#d4af37;font-weight:600;margin-bottom:4px}' +
      '.lg-msg{font-size:12.5px;color:#a99a78;margin-bottom:14px;line-height:1.5}' +
      '.lg-box input{width:100%;box-sizing:border-box;padding:12px;margin:6px 0;background:#0f0c07;border:1px solid #4a3f28;' +
        'border-radius:8px;color:#f0e6d2;font-size:16px}' +
      '.lg-btn{width:100%;margin-top:10px;padding:12px;border:none;border-radius:8px;background:#d4af37;color:#1a1408;' +
        'font-size:15px;font-weight:600;cursor:pointer}' +
      '.lg-btn2{width:100%;margin-top:8px;padding:11px;border:1px solid #d4af37;border-radius:8px;background:transparent;' +
        'color:#d4af37;font-size:14px;cursor:pointer}' +
      '.lg-err{color:#e8615a;font-size:12px;min-height:16px;margin-top:8px;text-align:center}';
    document.head.appendChild(st);
  }
  function _loginOverlay(msg) {
    if (document.getElementById('lgGate')) return;
    _ensureGateStyle();
    var w = document.createElement('div');
    w.id = 'lgGate';
    w.innerHTML =
      '<div class="lg-box">' +
        '<div class="lg-head"><span class="lg-ic">🔮</span><b>昊峯天机</b>' +
          '<button class="lg-x" id="lgX" aria-label="关闭">✕</button></div>' +
        '<div class="lg-title">请先登录</div>' +
        '<div class="lg-msg">' + (msg || '请先登录后再使用') + '</div>' +
        '<input id="lgAcct" type="text" placeholder="手机号 / 邮箱" autocomplete="username">' +
        '<input id="lgPw" type="password" placeholder="密码" autocomplete="current-password">' +
        '<button class="lg-btn" id="lgLoginBtn">登 录</button>' +
        '<button class="lg-btn2" id="lgRegBtn">没有账号？注册</button>' +
        '<div class="lg-err" id="lgErr"></div>' +
      '</div>';
    document.body.appendChild(w);
    function close() { _gateActive = false; try { w.parentNode.removeChild(w); } catch (e) {} }
    document.getElementById('lgX').onclick = close;
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    document.getElementById('lgRegBtn').onclick = function () {
      try { sessionStorage.setItem('__reg', '1'); } catch (e) {}
      location.href = '/xuetang#login';
    };
    function doLogin() {
      var acct = (document.getElementById('lgAcct').value || '').trim();
      var pw = document.getElementById('lgPw').value || '';
      var err = document.getElementById('lgErr');
      if (!acct || !pw) { err.textContent = '请输入账号和密码'; return; }
      var btn = document.getElementById('lgLoginBtn');
      btn.disabled = true; btn.textContent = '登录中…'; err.textContent = '';
      _fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: acct, password: pw }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) { err.textContent = (d && d.msg) || '登录失败，请重试'; btn.disabled = false; btn.textContent = '登 录'; return; }
          try {
            localStorage.setItem('yx_tk', d.token);
            var exp = new Date(Date.now() + 7 * 24 * 3600 * 1000).toUTCString();
            document.cookie = 'yx_tk=' + d.token + ';expires=' + exp + ';path=/;SameSite=Lax';
          } catch (e) {}
          btn.textContent = '登录成功，加载中…';
          location.reload();
        })
        .catch(function () { err.textContent = '网络错误，请重试'; btn.disabled = false; btn.textContent = '登 录'; });
    }
    document.getElementById('lgLoginBtn').onclick = doLogin;
    document.getElementById('lgPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    setTimeout(function () { try { document.getElementById('lgAcct').focus(); } catch (e) {} }, 120);
  }
  function loginGate(msg) {
    if (_gateActive && document.getElementById('lgGate')) return;
    _gateActive = true;    try { sessionStorage.setItem('__login_back', location.pathname + location.search + location.hash); } catch (e) {}
    try { global.alert = _realAlert; } catch (e) {}
    try { clearTimeout(_alertTimer); } catch (e) {}
    // 学堂页：直接弹其自带登录框
    if (/\/xuetang(\/|$|\?|#)/.test(location.pathname) || location.pathname === '/' || location.pathname === '') {
      try { if (typeof global.showAuth === 'function') { global.showAuth(msg); return; } } catch (e) {}
    }
    // 其它页：弹出全局登录界面弹层
    _loginOverlay(msg);
  }

  // 包裹 fetch：读取扣费响应头 + 处理 401 登录门禁（不改变原有响应行为）
  var _fetch = global.fetch ? global.fetch.bind(global) : null;
  if (_fetch) {
    global.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      return _fetch(input, init).then(function (resp) {
        try {
          var raw = resp.headers.get('X-Tool-Charge');
          var data = decodeHeader(raw);
          if (data) show(data);
        } catch (e) { /* 忽略读取异常，不影响业务 */ }
        // 登录门禁：仅对本站 /api/ 的「实际使用」请求（排除登录/注册/验证码/管理接口）
        try {
          var skip = url.indexOf('/api/login') !== -1 || url.indexOf('/api/register') !== -1 ||
                     url.indexOf('/api/send') !== -1 || url.indexOf('/api/admin/') !== -1;
          if (resp.status === 401 && url.indexOf('/api/') !== -1 && !skip &&
              (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            _suppressAlert(1500); // 同步静音页面自身的 401 alert，避免「弹两遍」
            resp.clone().json().then(function (d) {
              loginGate((d && d.msg) || '请先登录后再使用');
            }).catch(function () { loginGate('请先登录后再使用'); });
          }
        } catch (e) { /* 忽略 */ }
        return resp;
      });
    };
  }
  // 暴露全局登录入口（供游戏等页面在 GET 401 时直接唤起登录界面）
  try { global.LoginGate = { show: loginGate, overlay: _loginOverlay }; } catch (e) {}
})(window);
