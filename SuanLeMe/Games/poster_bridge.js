/* 算了吗 · 海报桥接 v2（由 App 注入 / 页面引用）
 * 让「分享海报」下方已有的「保存到相册 / 分享」按钮真正可用（App 内走原生保存/分享），
 * 并兼容浏览器（下载 / navigator.share / 长按保存）。
 * - 自动识别海报大图（data:image / blob: / 含 poster 关键字 / 大尺寸）
 * - 已有按钮则「重绑」（克隆清除失效的旧监听）；没有则自动追加
 * - 同时支持 <canvas> 海报
 */
(function () {
  if (window.__posterBridgeV2) return;
  window.__posterBridgeV2 = true;

  var isApp = !!(window.AndroidApp && window.AndroidApp.saveImage);
  // 原生桥「版本探测」：新版 APK 会暴露 getBridgeVersion()。
  // 旧 APK 注入的旧按钮可能失效，此时用底部兜底横幅保证一定能保存/分享。
  var nativeNew = false;
  try { nativeNew = !!(window.AndroidApp && window.AndroidApp.getBridgeVersion); } catch (e) {}
  var SAVE_TXT = ['保存到相册', '保存图片', '保存海报', '下载图片', '保存'];
  var SHARE_TXT = ['分享', '分享海报', '分享到'];

  // 即便桥尚未注入（时序竞态）也能识别「在 App 内」，从而给出长按兜底
  var uaApp = /SuanLeMeApp/i.test(navigator.userAgent || '');

  // 兜底横幅：只在 App 内、且为旧原生桥（无 getBridgeVersion）时显示
  function showBanner(getFn) {
    if (!isApp || nativeNew) return;
    if (window.__pbBannerClosed) return;
    var old = document.getElementById('__pbBanner');
    if (old) old.parentNode.removeChild(old);
    var bar = document.createElement('div');
    bar.id = '__pbBanner';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;gap:8px;align-items:center;padding:10px 12px;background:rgba(20,17,13,.96);border-top:1px solid #d4af37;box-shadow:0 -4px 16px rgba(0,0,0,.5)';
    var t = document.createElement('div');
    t.textContent = '海报已就绪';
    t.style.cssText = 'flex:1;color:#e8dcc8;font-size:13px;font-weight:700;font-family:sans-serif';
    var b1 = document.createElement('button');
    b1.type = 'button'; b1.textContent = '⬇ 保存到相册';
    b1.style.cssText = 'padding:11px 12px;border-radius:9px;border:0;background:#d4af37;color:#1a1612;font-size:14px;font-weight:700;white-space:nowrap';
    b1.onclick = function (e) { e.stopPropagation(); doSave(getFn()); };
    var b2 = document.createElement('button');
    b2.type = 'button'; b2.textContent = '↗ 分享';
    b2.style.cssText = 'padding:11px 12px;border-radius:9px;border:1px solid #d4af37;background:transparent;color:#d4af37;font-size:14px;font-weight:700;white-space:nowrap';
    b2.onclick = function (e) { e.stopPropagation(); doShare(getFn()); };
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '✕';
    x.style.cssText = 'padding:8px 10px;border-radius:8px;border:0;background:transparent;color:#9a8a6a;font-size:15px';
    x.onclick = function (e) { e.stopPropagation(); window.__pbBannerClosed = true; try { bar.parentNode.removeChild(bar); } catch (er) {} };
    bar.appendChild(t); bar.appendChild(b1); bar.appendChild(b2); bar.appendChild(x);
    (document.body || document.documentElement).appendChild(bar);
  }

  function isPosterImg(img) {
    if (!img || img.tagName !== 'IMG') return false;
    var s = img.getAttribute('data-poster-src') || img.getAttribute('data-orig-src') || img.src || '';
    if (!s) return false;
    if (s.indexOf('data:image') === 0 || s.indexOf('blob:') === 0) {
      return (img.offsetWidth >= 80 || img.naturalWidth >= 200);
    }
    if (/poster|haibao|share-?img/i.test(s) || /poster|share/i.test(img.className || '')) return true;
    return false;
  }

  function getSrc(img) {
    // 始终取当前 src（img 元素复用时，页面会直接改写 src；不能缓存，否则第二次生成会存到旧图）
    return img.src || img.getAttribute('data-poster-src') || img.getAttribute('data-orig-src') || '';
  }

  function toDataURL(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve('');
      if (src.indexOf('data:') === 0) return resolve(src);
      fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { resolve(''); };
        fr.readAsDataURL(b);
      }).catch(function () { resolve(''); });
    });
  }

  function fallbackDownload(src, name) {
    toDataURL(src).then(function (data) {
      if (!data) { alert('请长按图片保存，或截图分享'); return; }
      // App 内没有下载能力：降级为「全屏大图 + 提示长按保存」（复用原生长按菜单）
      if (uaApp || isApp) { showLongPressOverlay(src); return; }
      var a = document.createElement('a');
      a.href = data; a.download = (name || '算了吗海报') + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
  }

  // App 内兜底：把海报显示为全屏大图，提示「长按保存 / 截图分享」。
  // 长按走 App 原生 onLongClickListener -> showImageMenu -> 原生 saveImage/shareImage
  // （该路径不经过网页桥的 trusted()/getUrl()，因此不受此次 bg-thread 崩溃影响）
  function showLongPressOverlay(src) {
    try {
      var old = document.getElementById('__pbLongPressOverlay');
      if (old) old.parentNode.removeChild(old);
      var ov = document.createElement('div');
      ov.id = '__pbLongPressOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
      var im = document.createElement('img');
      // 保留 data:/blob: 原样，让 App 的长按 HitTestResult 能识别为图片
      im.src = src;
      im.setAttribute('data-poster-src', src);
      im.style.cssText = 'max-width:100%;max-height:78vh;border-radius:10px;object-fit:contain';
      var tip = document.createElement('div');
      tip.textContent = '长按图片 → 保存到相册 / 分享';
      tip.style.cssText = 'color:#e8dcc8;font-size:15px;font-weight:700;margin:14px 0 4px;text-align:center;font-family:sans-serif';
      var sub = document.createElement('div');
      sub.textContent = '也可直接截屏分享；点任意处关闭';
      sub.style.cssText = 'color:#9a8a6a;font-size:12px;margin-bottom:12px;text-align:center;font-family:sans-serif';
      var x = document.createElement('button');
      x.type = 'button'; x.textContent = '关闭';
      x.style.cssText = 'padding:10px 22px;border-radius:9px;border:1px solid #d4af37;background:transparent;color:#d4af37;font-size:14px;font-weight:700';
      ov.appendChild(im); ov.appendChild(tip); ov.appendChild(sub); ov.appendChild(x);
      ov.onclick = function () { try { ov.parentNode.removeChild(ov); } catch (e) {} };
      (document.body || document.documentElement).appendChild(ov);
    } catch (e) {}
  }

  // ===== 原生桥判定（关键） =====
  // 重要：@JavascriptInterface 方法内部抛出的异常会被 Android WebView **静默吞掉**，
  // 不会传播回 JS。所以 JS 端 try/catch **无法**感知旧原生桥（1.1.0 及更早）里
  // trusted() 调 mWebView.getUrl() 在 JavaBridge 后台线程触发的崩溃 —— 它会表现为
  // 「点击完全没反应，且没有任何异常」。因此只有当原生「确认可用」时（修复版 APK
  // 暴露 getBridgeVersion() >= 3）才直接走原生；否则一律给出可靠的长按兜底
  // （不依赖原生桥、不依赖存储权限，走 App 长按菜单的原生保存/分享）。
  function nativeFixed() {
    try {
      return !!(window.AndroidApp && window.AndroidApp.getBridgeVersion &&
                window.AndroidApp.getBridgeVersion() >= 3);
    } catch (e) { return false; }
  }

  function doSave(src) {
    toDataURL(src).then(function (data) {
      if (!data) { alert('图片读取失败，请重试或长按保存'); return; }
      if (isApp && window.AndroidApp.saveImage) {
        if (nativeFixed()) { window.AndroidApp.saveImage(data, '算了吗海报'); return; }
        // 旧原生桥可能静默失败：仍尝试一次，然后必定给出可靠的长按兜底
        try { window.AndroidApp.saveImage(data, '算了吗海报'); } catch (e) {}
        showLongPressOverlay(src);
        return;
      }
      fallbackDownload(src, '算了吗海报');
    });
  }

  function doShare(src) {
    toDataURL(src).then(function (data) {
      var payload = data || src;
      if (isApp && window.AndroidApp.shareImage) {
        if (nativeFixed()) { window.AndroidApp.shareImage(payload, '算了吗海报'); return; }
        try { window.AndroidApp.shareImage(payload, '算了吗海报'); } catch (e) {}
        showLongPressOverlay(src);
        return;
      }
      if (!data) { alert('图片读取失败，请重试'); return; }
      try {
        fetch(data).then(function (r) { return r.blob(); }).then(function (b) {
          var f = new File([b], 'suanleme-poster.png', { type: b.type || 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) {
            navigator.share({ files: [f], title: '算了吗' });
          } else { fallbackDownload(src, '算了吗海报'); }
        }).catch(function () { fallbackDownload(src, '算了吗海报'); });
      } catch (e) { fallbackDownload(src, '算了吗海报'); }
    });
  }

  function scopeOf(el) {
    return (el.closest && el.closest('[class*=poster],[class*=share],[id*=poster],[id*=share],.modal,.overlay,.box,.popup'))
      || (el.parentElement && el.parentElement.parentElement) || document;
  }

  function findButtons(scope, img) {
    var saveBtn = null, shareBtn = null;
    // 只认真正的按钮/链接元素：避免把「同时含保存+分享文案的外层容器」误判成分享按钮
    var els = scope.querySelectorAll('button,a');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (img && (el === img || el.contains(img) || img.contains(el))) continue;
      // 站点统一 action 条（UnifiedShare.actions）已自带「保存图片 / 分享海報」，
      // 不复用/不重绑，避免与 bridge 自动按钮条重复。
      if (el.hasAttribute && (el.hasAttribute('data-pb') || (el.classList && el.classList.contains('us-action-btn')))) continue;
      var tx = (el.textContent || '').trim();
      if (!tx || tx.length > 14) continue;
      var hasShare = SHARE_TXT.some(function (t) { return tx.indexOf(t) >= 0; });
      var hasSave = SAVE_TXT.some(function (t) { return tx.indexOf(t) >= 0; });
      if (!saveBtn && hasSave && !hasShare) saveBtn = el;
      else if (!shareBtn && hasShare) shareBtn = el;
    }
    return { save: saveBtn, share: shareBtn };
  }

  function rebind(el, handler, label) {
    var clone = el.cloneNode(true);
    clone.setAttribute('data-pb', label || '1');
    clone.onclick = function (e) { e.preventDefault(); e.stopPropagation(); handler(); };
    el.parentNode.replaceChild(clone, el);
  }

  function addBar(img) {
    if (img.__pbBar) return;
    var bar = document.createElement('div');
    bar.className = '__posterBar';
    bar.style.cssText = 'display:flex;gap:10px;justify-content:center;margin:10px auto 2px;max-width:420px';
    var b1 = document.createElement('button');
    b1.type = 'button'; b1.textContent = '⬇ 保存到相册'; b1.setAttribute('data-pb', 'save');
    b1.style.cssText = 'flex:1;padding:11px 8px;border-radius:9px;border:1px solid #d4af37;background:#d4af37;color:#1a1612;font-size:14px;font-weight:700;cursor:pointer';
    b1.onclick = function (e) { e.stopPropagation(); doSave(getSrc(img)); };
    var b2 = document.createElement('button');
    b2.type = 'button'; b2.textContent = '↗ 分享'; b2.setAttribute('data-pb', 'share');
    b2.style.cssText = 'flex:1;padding:11px 8px;border-radius:9px;border:1px solid #d4af37;background:transparent;color:#d4af37;font-size:14px;font-weight:700;cursor:pointer';
    b2.onclick = function (e) { e.stopPropagation(); doShare(getSrc(img)); };
    bar.appendChild(b1); bar.appendChild(b2);
    if (img.parentNode) img.parentNode.insertBefore(bar, img.nextSibling);
    img.__pbBar = bar;
  }

  function hasUnifiedBar(scope) {
    try { return !!(scope && scope.querySelector && scope.querySelector('.us-action-bar, .us-action-btn')); }
    catch (e) { return false; }
  }

  function bindPoster(img) {
    if (!img) return;
    // 海报图 src 可能被页面复用改写：每次生成都重新绑定到最新的图
    if (img.__pbBar) { try { img.__pbBar.parentNode && img.__pbBar.parentNode.removeChild(img.__pbBar); } catch (e) {} img.__pbBar = null; }
    img.__pbBound = true;
    img.__pbSrc = img.src;
    var scope = scopeOf(img);
    // 该海报所在弹层已使用站点统一 action 条（UnifiedShare）→ 不再追加/重绑，避免重复按钮
    if (hasUnifiedBar(scope)) return;
    var btns = findButtons(scope, img);
    if (btns.save || btns.share) {
      if (btns.save) rebind(btns.save, function () { doSave(getSrc(img)); }, 'save');
      if (btns.share) rebind(btns.share, function () { doShare(getSrc(img)); }, 'share');
      if (!btns.save || !btns.share) addBar(img);   // 缺一个就补一条（带两个按钮）
    } else {
      addBar(img);
    }
    // 旧 APK（原生桥无版本探针）→ 提供永远可用的兜底横幅
    showBanner(function () { return getSrc(img); });
  }

  function canvasDataURL(cv) { try { return cv.toDataURL('image/png'); } catch (e) { return ''; } }

  function bindCanvas(cv, scope) {
    var btns = findButtons(scope, null);
    if (btns.save) rebind(btns.save, function () { var d = canvasDataURL(cv); if (!d) return alert('导出失败'); doSave(d); });
    if (btns.share) rebind(btns.share, function () { var d = canvasDataURL(cv); if (!d) return alert('导出失败'); doShare(d); });
  }

  function scan() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      try {
        if (!isPosterImg(im)) continue;
        if (!im.__pbBound) { bindPoster(im); continue; }
        // 海报弹层会复用同一个 <img>，新图直接改写 src → 需要重新绑定到最新图
        if (im.__pbSrc !== im.src) { im.__pbSrc = im.src; bindPoster(im); }
      } catch (e) {}
    }
    var cvs = document.querySelectorAll('canvas');
    for (var j = 0; j < cvs.length; j++) {
      var cv = cvs[j];
      try {
        if (cv.__pbBound) continue;
        if (cv.offsetWidth < 150 || cv.offsetHeight < 150) continue;
        var scope = scopeOf(cv);
        var btns = findButtons(scope, null);
        if (!btns.save && !btns.share) continue;
        cv.__pbBound = true;
        bindCanvas(cv, scope);
      } catch (e) {}
    }
  }

  try {
    var mo = new MutationObserver(function () { setTimeout(scan, 60); });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () { setTimeout(scan, 150); });
  setInterval(scan, 1000);
  setTimeout(scan, 400);
})();
