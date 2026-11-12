/* ============================================================
 * dialog.js — 站内统一弹层（2026-10-30）
 *
 * 为什么需要它：
 *   手机浏览器在原生 alert()/confirm() 的标题栏会显示当前网页的完整
 *   网址（例如「網址為 https://tianji.matetechhk.com 的網頁顯示：」），
 *   既泄露内部域名、又显得像钓鱼弹窗，破坏观感。
 *
 * 做法：
 *   - window.alert    → 直接改写成站内弹层（alert 无返回值，可安全替换）
 *   - window.confirm  → 同步 API 无法替换，必须改调用点；
 *                       本文件提供 Dlg.confirm(msg) 返回 Promise<boolean>
 *
 * 用法：
 *   Dlg.confirm('确定删除？').then(function(ok){ if(!ok) return; ... });
 *   也兼容 await： if(!await Dlg.confirm('...')) return;
 * ============================================================ */
(function (w, d) {
  'use strict';
  if (w.__DLG_READY__) return;
  w.__DLG_READY__ = true;

  var CSS = ''
    + '#dlgMask{position:fixed;inset:0;z-index:2147483000;display:none;'
    + 'align-items:center;justify-content:center;padding:20px;'
    + 'background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}'
    + '#dlgMask.on{display:flex}'
    + '#dlgBox{width:100%;max-width:380px;max-height:80vh;overflow:auto;'
    + 'border-radius:18px;padding:22px 20px 18px;'
    + 'background:linear-gradient(165deg,#3a2c18,#1d1509);'
    + 'border:1px solid rgba(255,210,90,.55);'
    + 'box-shadow:0 12px 48px rgba(0,0,0,.6);'
    + 'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;'
    + 'animation:dlgIn .16s ease-out}'
    + '@keyframes dlgIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}'
    + '#dlgTitle{font-size:13px;letter-spacing:3px;color:#ffd777;font-weight:800;'
    + 'text-align:center;margin-bottom:12px}'
    + '#dlgText{font-size:14px;line-height:1.95;color:#f0e4cc;'
    + 'white-space:pre-line;word-break:break-word;text-align:center}'
    + '#dlgActs{display:flex;gap:10px;margin-top:20px}'
    + '#dlgActs button{flex:1;padding:13px;border-radius:12px;border:none;'
    + 'font-size:15px;font-weight:900;font-family:inherit;cursor:pointer}'
    + '#dlgNo{background:rgba(0,0,0,.36);color:#b8a888;'
    + 'border:1px solid rgba(212,175,55,.3)!important}'
    + '#dlgYes{background:linear-gradient(135deg,#f5d06f,#c9a227);color:#2a1206}'
    + '#dlgYes:active,#dlgNo:active{transform:scale(.97)}';

  var st = d.createElement('style');
  st.textContent = CSS;
  (d.head || d.documentElement).appendChild(st);

  var mask, box, titleEl, textEl, actsEl, btnNo, btnYes, resolver = null;

  function build() {
    if (mask) return;
    mask = d.createElement('div');
    mask.id = 'dlgMask';
    box = d.createElement('div');
    box.id = 'dlgBox';
    titleEl = d.createElement('div');
    titleEl.id = 'dlgTitle';
    textEl = d.createElement('div');
    textEl.id = 'dlgText';
    actsEl = d.createElement('div');
    actsEl.id = 'dlgActs';
    btnNo = d.createElement('button');
    btnNo.id = 'dlgNo';
    btnNo.type = 'button';
    btnNo.textContent = '取消';
    btnYes = d.createElement('button');
    btnYes.id = 'dlgYes';
    btnYes.type = 'button';
    btnYes.textContent = '確定';
    actsEl.appendChild(btnNo);
    actsEl.appendChild(btnYes);
    box.appendChild(titleEl);
    box.appendChild(textEl);
    box.appendChild(actsEl);
    mask.appendChild(box);
    d.body.appendChild(mask);

    btnYes.onclick = function () { done(true); };
    btnNo.onclick = function () { done(false); };
    mask.addEventListener('click', function (e) {
      if (e.target === mask) done(false);   // 点遮罩 = 取消
    });
  }

  function done(val) {
    if (!mask) return;
    mask.classList.remove('on');
    var r = resolver;
    resolver = null;
    if (r) { try { r(val); } catch (e) {} }
  }

  d.addEventListener('keydown', function (e) {
    if (!mask || !mask.classList.contains('on')) return;
    if (e.key === 'Escape') done(false);
    if (e.key === 'Enter') done(true);
  });

  var Dlg = {
    /* 提示：只有一个按钮，返回 Promise 便于串行 */
    alert: function (msg, opt) {
      opt = opt || {};
      return new Promise(function (resolve) {
        build();
        titleEl.textContent = opt.title || '提 示';
        textEl.textContent = String(msg == null ? '' : msg);
        actsEl.style.display = '';
        btnNo.style.display = 'none';
        btnYes.textContent = opt.okText || '知道了';
        mask.classList.add('on');
        resolver = function () { resolve(true); };
      });
    },
    /* 确认：两个按钮，返回 Promise<boolean> */
    confirm: function (msg, opt) {
      opt = opt || {};
      return new Promise(function (resolve) {
        build();
        titleEl.textContent = opt.title || '請 確 認';
        textEl.textContent = String(msg == null ? '' : msg);
        actsEl.style.display = '';
        btnNo.style.display = '';
        btnNo.textContent = opt.cancelText || '取消';
        btnYes.textContent = opt.okText || '確定';
        mask.classList.add('on');
        resolver = resolve;
      });
    }
  };

  w.Dlg = Dlg;

  /* ===== 关键：改写原生 alert，全站 245 处调用点无需改动 ===== */
  w.alert = function (msg) { Dlg.alert(msg); };

  /* confirm 是同步 API，无法改写为异步而不破坏调用方逻辑。
     这里保留原生实现作为兜底，但正式页面应改用 Dlg.confirm()。*/
})(window, document);
