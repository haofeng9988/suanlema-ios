/* 算了吗 · App 更新引导 app-update.js
 * 作用：网页内检测「算了吗 App」是否为最新壳版本；若为旧版则弹出更新引导。
 * 背景：App 是 WebView 壳，网页更新实时生效，但旧版壳（<1.0.6）没有自动更新能力，
 *       需引导用户下载带自动更新功能的新版外壳。装了新版后，以后自动更新。
 * 触发：仅当 UA 含 SuanLeMeApp/ 时（即 App 内）才提示，普通浏览器不打扰。
 */
(function () {
  'use strict';
  if (window.__appUpdateLoaded) return;
  window.__appUpdateLoaded = true;

  var ua = navigator.userAgent || '';
  if (ua.indexOf('SuanLeMeApp/') < 0) return;   // 非 App 内，忽略

  // 从 UA 解析当前壳版本与 versionCode
  var m = ua.match(/SuanLeMeApp\/([\d.]+)(?:\s*\(Android;\s*code\s*(\d+)\))?/);
  var curName = m ? m[1] : '';
  var curCode = m && m[2] ? parseInt(m[2], 10) : 0;

  var DS_KEY = 'yx_app_update_dismiss';
  var CACHE_KEY = 'yx_app_ver_cache';

  // 壳版本 >= 7（1.0.7+）自带原生自动更新，网页端不再打扰
  var NATIVE_MIN = 7;
  if (curCode >= NATIVE_MIN) return;

  function today() { return new Date().toISOString().slice(0, 10); }

  function show(cfg) {
    if (document.getElementById('yxAppUpd')) return;
    var force = !!cfg.force;
    var box = document.createElement('div');
    box.id = 'yxAppUpd';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px';
    box.innerHTML =
      '<div style="background:#1a1612;border:1px solid #3a3224;border-radius:16px;max-width:400px;width:100%;padding:22px;color:#e8dcc8;box-shadow:0 14px 44px rgba(0,0,0,.55);text-align:center">' +
        '<div style="font-size:38px">🆕</div>' +
        '<h3 style="margin:8px 0 4px;color:#d4af37">发现新版本 ' + (cfg.versionName || '') + '</h3>' +
        '<p style="color:#9a8a6a;font-size:13px;margin:0 0 12px;white-space:pre-wrap">' + (cfg.notes || '建议更新到最新版本，体验更好') + '</p>' +
        '<div style="background:#241f18;border-radius:10px;padding:10px;font-size:12px;line-height:1.8;color:#e8dcc8;text-align:left">' +
          '✅ 更新后 App 可自动更新，以后无需再手动下载<br>✅ 你的账号与数据不会丢失' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
          (force ? '' : '<button id="yxAppUpdLater" style="flex:1;padding:11px;border-radius:10px;border:1px solid #3a3224;background:transparent;color:#9a8a6a;font-size:14px">以后再说</button>') +
          '<button id="yxAppUpdNow" style="flex:2;padding:11px;border-radius:10px;border:0;background:#d4af37;color:#1a1612;font-size:14px;font-weight:600">立即更新</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(box);

    var later = document.getElementById('yxAppUpdLater');
    if (later) later.onclick = function () {
      try { localStorage.setItem(DS_KEY, today()); } catch (e) {}
      box.remove();
    };
    document.getElementById('yxAppUpdNow').onclick = function () {
      var url = cfg.url;
      try {
        var ua2 = navigator.userAgent;
        if (/(iPhone|iPad|iPod|iOS)/i.test(ua2)) {
          alert('请在 App Store 更新');// iOS 不适用
          return;
        }
      } catch (e) {}
      // 在 App 的 WebView 内直接打开下载链接；MainActivity 的 DownloadListener 会转交系统下载
      window.location.href = url;
    };
  }

  function check() {
    // 当天已点过「以后再说」则不再打扰
    try { if (localStorage.getItem(DS_KEY) === today()) return; } catch (e) {}

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/app/version', true);
    xhr.timeout = 8000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) return;
      var cfg;
      try { cfg = JSON.parse(xhr.responseText); } catch (e) { return; }
      if (!cfg || !cfg.versionCode) return;
      // 本机壳版本过低（或 UA 无法识别版本时兜底按 code=0 也能触发）才提示
      if (cfg.versionCode > curCode) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) {}
        show(cfg);
      }
    };
    try { xhr.send(); } catch (e) {}
  }

  // 页面加载完成后检测（稍延后，避免影响首屏）
  if (document.readyState === 'complete') setTimeout(check, 1200);
  else window.addEventListener('load', function () { setTimeout(check, 1200); });
})();
