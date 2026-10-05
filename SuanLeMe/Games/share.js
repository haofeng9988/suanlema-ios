/* 算了吗 · 分享组件（带邀请码） share.js
 * 所有独立工具页（天机转盘/天机签/卦盘等）统一接入，分享时带上会员邀请码：
 *   - 复制邀请链接 / 系统分享（navigator.share）
 *   - 可选：生成分享海报（后端 /api/share/poster，底部带邀请码）
 *
 * 用法：
 *   ShareInvite.share({ text:'占事业·签号12', headline:'天机签', lines:[...], path:'/qimen-bagua-sign' })
 *     → 优先 navigator.share（带链接），否则复制邀请链接
 *   ShareInvite.copyLink(path)
 *   ShareInvite.poster({ title, headline, score_line, lines })  → 弹海报
 */
(function(global){
  'use strict';
  var _invite = '';
  var API = (function(){
    // 推断 API 前缀（与各页保持一致）；为空则用同源
    return ((global.API || '') && String(global.API).replace(/\/$/,'')) || location.origin;
  })();

  function token(){
    return localStorage.getItem('yx_tk') || '';
  }
  function getInvite(cb){
    if(_invite)return cb(_invite);
    try{
      fetch(API + '/api/me', { headers:{ 'X-Token': token() } })
        .then(function(r){ return r.json(); })
        .then(function(r){
          if(r.ok && r.user && r.user.invite_code){
            _invite = r.user.invite_code;
          }
          cb(_invite);
        })
        .catch(function(){ cb(''); });
    }catch(e){ cb(''); }
  }
  function buildLink(path){
    var base = location.origin + (path || location.pathname);
    var code = _invite || '';
    return base + (base.indexOf('?')>=0 ? '&' : '?') + 'ref=' + encodeURIComponent(code);
  }
  function copyText(txt, okMsg){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ alert(okMsg); }).catch(function(){ prompt('复制此链接', txt); });
    }else{
      var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); alert(okMsg); }catch(e){ prompt('复制此链接', txt); }
      document.body.removeChild(ta);
    }
  }
  // 弹海报（复用后端 /api/share/poster）
  function poster(opts){
    opts = opts || {};
    if(!document.getElementById('sharePosterModal')){
      var m=document.createElement('div');
      m.id='sharePosterModal';
      m.className='modal';
      m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:16px';
      m.innerHTML='<div style="background:#1a1612;border:1px solid #3a2e1e;border-radius:14px;padding:16px;max-width:90vw;max-height:88vh;overflow:auto"><div id="sharePosterBody" style="color:#9a8a6a">生成中…</div><button onclick="this.closest(\'#sharePosterModal\').style.display=\'none\'" style="width:100%;margin-top:10px;padding:10px;background:transparent;border:1px solid #3a2e1e;color:#9a8a6a;border-radius:8px">关闭</button></div>';
      document.body.appendChild(m);
    }
    var modal=document.getElementById('sharePosterModal');
    var body=document.getElementById('sharePosterBody');
    body.innerHTML='<div style="color:#9a8a6a;padding:10px">生成海报中…</div>';
    modal.style.display='flex';
    var payload = {
      title: opts.title || '算了吗',
      headline: opts.headline || '',
      score_line: opts.score_line || '',
      lines: opts.lines || []
    };
    fetch(API + '/api/share/poster', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'X-Token': token() },
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); }).then(function(r){
      if(r.ok){
        body.innerHTML='<img src="data:image/png;base64,'+r.image+'" style="width:100%;border-radius:10px">';
      }else{
        body.innerHTML='<div style="color:#c1432f">'+((r&&r.msg)||'生成失败')+'</div>';
      }
    }).catch(function(e){
      body.innerHTML='<div style="color:#c1432f">生成失败：'+e.message+'</div>';
    });
  }
  function share(opts){
    opts = opts || {};
    var text = opts.text || '算了吗';
    var path = opts.path || location.pathname;
    getInvite(function(){
      var link = buildLink(path);
      var fullText = text + '\n\n' + (opts.append || '') + (opts.append?'\n':'') + link;
      if(navigator.share){
        navigator.share({ title:'算了吗', text:text, url:link }).catch(function(){ copyText(fullText, '已复制邀请链接'); });
      }else{
        copyText(fullText, '已复制邀请链接，好友通过它注册你将获得积分奖励');
      }
    });
  }
  function copyLink(path){
    getInvite(function(){
      var link = buildLink(path);
      copyText(link, '邀请链接已复制，好友通过它注册你将获得积分奖励');
    });
  }

  // ===== 全站统一分享海报（唯一入口） =====
  // UnifiedShare.open({ tool, name, score, level, subtitle })
  //   → 调后端唯一海报入口 /api/share/poster（规范字段），内部一律走统一模板：
  //     「品牌/工具名头 + 姓名 + 大号分数 + 级数 + 会员邀请码二维码」。
  //   自注入展示弹层（含长按保存提示），兼容 App WebView 的 poster_bridge.js
  //   （其会自动识别 data:image 大图并追加「保存到相册 / 分享」按钮）。
  //   score 取不到时可传 null/''/undefined → 海报显示「—」，不报错。
  // ===== 统一海报 payload / 取图（保存 & 分享共用同一条制作逻辑）=====
  function _normBg(v){ return (String(v === undefined || v === null ? '' : v).trim().toLowerCase() === 'warm') ? 'warm' : 'cool'; }
  function _withBg(opts, bg){
    var p = {}, k;
    opts = opts || {};
    for (k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) p[k] = opts[k]; }
    p.bg = _normBg(bg);
    return p;
  }
  function _payload(opts){
    opts = opts || {};
    return {
      tool: opts.tool || opts.title || '算了吗',
      name: opts.name || '',
      score: (opts.score === undefined || opts.score === null) ? '' : opts.score,
      level: opts.level || '',
      subtitle: opts.subtitle || opts.score_line || '',
      brand: opts.brand || '算了吗',
      chart_svg: opts.chart_svg || '',
      bg: _normBg(opts.bg)
    };
  }
  function _fetchPoster(opts){
    return fetch(API + '/api/share/poster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': token() },
      body: JSON.stringify(_payload(opts))
    }).then(function(r){ return r.json(); });
  }
  function _dataUri(b64){ return 'data:image/png;base64,' + b64; }

  // ===== 原生桥判定（与 poster_bridge.js 口径一致，避免两套不兼容实现）=====
  function _isApp(){ try { return !!(global.AndroidApp && global.AndroidApp.saveImage); } catch (e) { return false; } }
  // 旧 APK（无 getBridgeVersion）的原生桥可能静默失败 → 需给长按兜底
  function _nativeFixed(){
    try {
      return !!(global.AndroidApp && global.AndroidApp.getBridgeVersion &&
                global.AndroidApp.getBridgeVersion() >= 3);
    } catch (e) { return false; }
  }

  // App 内兜底：全屏大图 + 长按提示（走 App 原生长按菜单保存/分享）
  function _longPressTip(dataUri, tip){
    try {
      var old = document.getElementById('usLongPressOverlay');
      if (old) old.parentNode.removeChild(old);
      var ov = document.createElement('div');
      ov.id = 'usLongPressOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center';
      var im = document.createElement('img');
      im.src = dataUri || '';
      im.setAttribute('data-poster-src', dataUri || '');
      im.style.cssText = 'max-width:100%;max-height:74vh;border-radius:10px;object-fit:contain';
      var t = document.createElement('div');
      t.textContent = tip || '长按图片 → 保存到相册 / 分享';
      t.style.cssText = 'color:#e8dcc8;font-size:14px;font-weight:700;margin:14px 0 4px;font-family:sans-serif';
      var s = document.createElement('div');
      s.textContent = '也可直接截屏分享；点任意处关闭';
      s.style.cssText = 'color:#9a8a6a;font-size:12px;margin-bottom:12px;font-family:sans-serif';
      ov.appendChild(im); ov.appendChild(t); ov.appendChild(s);
      ov.onclick = function(){ try { ov.parentNode.removeChild(ov); } catch (e) {} };
      (document.body || document.documentElement).appendChild(ov);
    } catch (e) { alert(tip || '请长按图片保存，或截图分享'); }
  }

  // 保存：App 原生 saveImage / 浏览器 <a download> / 兜底长按
  function _saveDataUri(dataUri, name){
    if (!dataUri) { alert('海报未就绪，请重试'); return; }
    name = name || '算了吗海报';
    if (_isApp() && global.AndroidApp.saveImage) {
      if (_nativeFixed()) {
        try { global.AndroidApp.saveImage(dataUri, name); return; } catch (e) {}
      }
      try { global.AndroidApp.saveImage(dataUri, name); } catch (e) {}
      _longPressTip(dataUri, '若未提示保存成功，请长按图片 → 保存到相册');
      return;
    }
    try {
      var a = document.createElement('a');
      a.href = dataUri; a.download = name + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      _longPressTip(dataUri, '浏览器未能自动下载，请长按图片保存');
    }
  }

  // 分享：App 原生 shareImage / 浏览器 navigator.share(files) / 兜底长按
  function _shareDataUri(dataUri, name){
    if (!dataUri) { alert('海报未就绪，请重试'); return; }
    name = name || '算了吗海报';
    if (_isApp() && global.AndroidApp.shareImage) {
      if (_nativeFixed()) {
        try { global.AndroidApp.shareImage(dataUri, name); return; } catch (e) {}
      }
      try { global.AndroidApp.shareImage(dataUri, name); } catch (e) {}
      _longPressTip(dataUri, '若未弹出分享，请长按图片 → 分享');
      return;
    }
    try {
      fetch(dataUri).then(function(r){ return r.blob(); }).then(function(b){
        var f = new File([b], 'suanleme-poster.png', { type: b.type || 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          navigator.share({ files: [f], title: '算了吗' })
            .catch(function(){ _longPressTip(dataUri, '已就绪，请长按图片保存 / 分享'); });
        } else if (navigator.share) {
          navigator.share({ title: '算了吗' })
            .catch(function(){ _longPressTip(dataUri, '已就绪，请长按图片保存 / 分享'); });
        } else {
          _longPressTip(dataUri, '无法直接分享，请长按图片保存 / 分享');
        }
      }).catch(function(){ _longPressTip(dataUri, '已就绪，请长按图片保存 / 分享'); });
    } catch (e) { _longPressTip(dataUri, '已就绪，请长按图片保存 / 分享'); }
  }

  function _ensureUnifiedOverlay(){
    var ov = document.getElementById('usPosterOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'usPosterOverlay';
    ov.className = 'img-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px';
    ov.innerHTML =
      '<div style="max-height:92vh;overflow:auto;text-align:center;max-width:440px;width:100%">' +
        '<div id="usBgs" style="display:flex;gap:8px;justify-content:center;margin:0 0 10px">' +
          '<button type="button" class="us-bg-chip" data-bg="cool">🟡 暗金调</button>' +
          '<button type="button" class="us-bg-chip" data-bg="warm">🟠 暖金调</button>' +
        '</div>' +
        '<img id="usPosterImg" alt="分享海报" style="max-width:100%;border-radius:12px;min-height:60px">' +
        '<div style="font-size:12px;color:#9a8a6a;margin:10px 0;line-height:1.6">长按图片保存 → 分享到微信 / WhatsApp / 好友<br>海报含你的会员邀请码，好友注册你赚积分</div>' +
        '<div id="usActions" style="display:flex;gap:10px;max-width:420px;margin:0 auto 8px">' +
          '<button id="usSaveBtn" type="button" style="flex:1;padding:11px;border-radius:9px;border:0;background:#d4af37;color:#1a1612;font-size:14px;font-weight:700;cursor:pointer">💾 保存图片</button>' +
          '<button id="usShareBtn" type="button" style="flex:1;padding:11px;border-radius:9px;border:1px solid #d4af37;background:transparent;color:#d4af37;font-size:14px;font-weight:700;cursor:pointer">📲 分享海報</button>' +
        '</div>' +
        '<button id="usPosterClose" type="button" style="width:100%;padding:11px;border-radius:9px;border:1px solid #3a2e1e;background:transparent;color:#9a8a6a;font-size:14px">关闭</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if (e.target === ov) hideU(); });
    var cb = document.getElementById('usPosterClose');
    if (cb) cb.onclick = function(e){ e.preventDefault(); hideU(); };
    var sb = document.getElementById('usSaveBtn');
    if (sb) sb.onclick = function(e){ e.preventDefault(); _onSave(ov); };
    var shb = document.getElementById('usShareBtn');
    if (shb) shb.onclick = function(e){ e.preventDefault(); _onShare(ov); };
    var bgs = document.getElementById('usBgs');
    if (bgs) bgs.addEventListener('click', function(e){
      var b = e.target && e.target.closest && e.target.closest('.us-bg-chip');
      if (b) _pickBg(ov, b.getAttribute('data-bg'));
    });
    return ov;
  }

  // ===== 模板选择（暗金 / 暖金）：chip 选中态 + 进度中禁用（防重入）=====
  function _paintBgChips(ov){
    var wrap = document.getElementById('usBgs');
    if (!wrap) return;
    var cur = ov.__usBg || 'cool';
    var busy = !!ov.__usBusy;
    var chips = wrap.querySelectorAll('.us-bg-chip');
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i], on = (c.getAttribute('data-bg') === cur);
      c.disabled = busy;
      c.style.cssText = 'flex:1;padding:7px 10px;border-radius:999px;font-size:13px;font-weight:700;cursor:' +
        (busy ? 'default' : 'pointer') + ';opacity:' + (busy ? '.55' : '1') + ';' +
        (on ? 'border:1.5px solid #d4af37;background:rgba(212,175,55,.16);color:#e8cf7a'
            : 'border:1.5px solid rgba(212,175,55,.28);background:transparent;color:#9a8a6a');
    }
  }
  function _pickBg(ov, bg){
    bg = _normBg(bg);
    if (ov.__usBusy || bg === (ov.__usBg || 'cool')) return;
    ov.__usBg = bg;
    _renderPoster(ov);
  }
  // 出图：按 ov.__usBg 拉取海报并回填 <img>；进度中禁用切换条（防重入）
  function _renderPoster(ov){
    var img = document.getElementById('usPosterImg');
    var ua = document.getElementById('usActions');
    ov.__usBusy = true;
    ov.__usDataUri = '';
    _paintBgChips(ov);
    if (img) { img.style.opacity = '0.35'; img.removeAttribute('src'); img.removeAttribute('data-poster-src'); }
    if (ua) ua.style.display = 'none';   // 出图后再显示「保存图片 / 分享海報」
    return _fetchPoster(_withBg(ov.__usOpts, ov.__usBg)).then(function(r){
      ov.__usBusy = false;
      _paintBgChips(ov);
      if (r && r.ok && r.image) {
        var data = _dataUri(r.image);
        ov.__usDataUri = data;
        if (img) { img.style.opacity = '1'; img.src = data; img.setAttribute('data-poster-src', data); }
        if (ua) ua.style.display = 'flex';
      } else {
        if (img) { img.style.opacity = '1'; img.removeAttribute('src'); }
        alert((r && r.msg) || '生成失败，请重试');
      }
    }).catch(function(e){
      ov.__usBusy = false;
      _paintBgChips(ov);
      if (img) { img.style.opacity = '1'; img.removeAttribute('src'); }
      alert('生成失败：' + (e && e.message ? e.message : e));
    });
  }
  // 保存 / 分享优先复用已展示的当前模板海报（响应更短），未就绪则按当前模板即时生成
  function _onSave(ov){
    if (ov.__usDataUri) { _saveDataUri(ov.__usDataUri, ((ov.__usOpts && ov.__usOpts.tool) || '算了吗') + '海报'); return; }
    save(_withBg(ov.__usOpts, ov.__usBg));
  }
  function _onShare(ov){
    if (ov.__usDataUri) { _shareDataUri(ov.__usDataUri, ((ov.__usOpts && ov.__usOpts.tool) || '算了吗') + '海报'); return; }
    open(_withBg(ov.__usOpts, ov.__usBg));
  }
  function hideU(){
    var ov = document.getElementById('usPosterOverlay'); if (ov) ov.style.display = 'none';
    var lp = document.getElementById('usLongPressOverlay'); if (lp) lp.style.display = 'none';
  }
  function open(opts){
    opts = opts || {};
    var ov = _ensureUnifiedOverlay();
    ov.__usOpts = opts;
    ov.__usBg = _normBg(opts.bg);   // 默认「暗金调」；每次打开重新选（不持久化）
    ov.style.display = 'flex';
    return _renderPoster(ov);
  }

  // ===== 结果操作区统一 2 按钮条：💾 保存图片 / 📲 分享海報 =====
  // UnifiedShare.actions(container, opts) —— 渲染统一 2 按钮（保存=直接存图；分享=出统一海报弹层）。
  // 两者基于同一 payload（tool/name/score/level/subtitle[+chart_svg]）。
  function actions(container, opts){
    if (!container) return null;
    opts = opts || {};
    var old = container.querySelector && container.querySelector('.us-action-bar');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var wrap = document.createElement('div');
    wrap.className = 'us-action-bar';
    wrap.style.cssText = 'display:flex;gap:10px;justify-content:center;margin:8px auto 2px;max-width:460px;width:100%';
    var b1 = document.createElement('button');
    b1.type = 'button'; b1.className = 'us-action-btn';
    b1.textContent = '💾 保存图片';
    b1.style.cssText = 'flex:1;padding:11px 10px;border-radius:9px;border:0;background:#d4af37;color:#1a1612;font-size:14px;font-weight:700;cursor:pointer';
    b1.onclick = function(e){ e.preventDefault(); save(opts); };
    var b2 = document.createElement('button');
    b2.type = 'button'; b2.className = 'us-action-btn';
    b2.textContent = '📲 分享海報';
    b2.style.cssText = 'flex:1;padding:11px 10px;border-radius:9px;border:1px solid #d4af37;background:transparent;color:#d4af37;font-size:14px;font-weight:700;cursor:pointer';
    b2.onclick = function(e){ e.preventDefault(); open(opts); };
    wrap.appendChild(b1); wrap.appendChild(b2);
    container.appendChild(wrap);
    return wrap;
  }

  // ===== 保存图片：生成统一海报并直接保存（App 原生存相册 / 浏览器下载）=====
  function save(opts){
    _fetchPoster(opts).then(function(r){
      if (!r || !r.ok || !r.image) { alert((r && r.msg) || '生成失败，请重试'); return; }
      _saveDataUri(_dataUri(r.image), ((opts && opts.tool) || '算了吗') + '海报');
    }).catch(function(e){ alert('生成失败：' + (e && e.message ? e.message : e)); });
  }

  global.ShareInvite = {
    share: share,
    copyLink: copyLink,
    poster: poster,
    getInvite: getInvite,
    buildLink: buildLink
  };
  global.UnifiedShare = {
    open: open,
    share: open,        // 分享 = 出统一海报弹层（弹层内「保存图片 / 分享海報」）
    save: save,         // 保存图片 = 生成统一海报并直接保存
    actions: actions,   // 统一 2 按钮条
    close: hideU
  };
})(window);
