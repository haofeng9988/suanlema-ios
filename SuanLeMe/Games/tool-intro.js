/* 天机玩了吗 · 离线版落地页组件（App 内置，不联网）
 * 与网页版 ToolIntro.mount 接口一致，但：
 *  - 不请求 /api/tool/<tool>/access（离线环境无后端）
 *  - 收费区显示「免费」（游戏娱乐，不涉付费）
 *  - 返回按钮指向本地 home.html
 * 用法：ToolIntro.mount({tool,icon,title,slogan,steps[],note,onEnter})
 */
(function () {
  if (window.ToolIntro) return;

  var CSS = ''
    + '#tiMask{position:fixed;inset:0;z-index:9000;background:var(--bg,#1a1612);overflow-y:auto;-webkit-overflow-scrolling:touch}'
    + '#tiMask .ti-scroll{max-width:500px;margin:0 auto;padding:14px 14px 30px}'
    + '#tiMask .ti-top{position:sticky;top:0;z-index:2;padding:8px 0;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(26,22,18,.85));display:flex;align-items:center}'
    + '#tiMask .ti-back{color:var(--gold,#d4af37);text-decoration:none;font-size:14px;border:1px solid var(--gold,#d4af37);border-radius:8px;padding:5px 12px;line-height:1;background:none}'
    + '#tiMask .ti-hero{text-align:center;padding:24px 14px;background:linear-gradient(180deg,#2a2218,#1a1612);border:1px solid #3a2e1e;border-radius:16px;margin-bottom:14px}'
    + '#tiMask .ti-hero .big{font-size:46px;line-height:1}'
    + '#tiMask .ti-hero h1{font-size:25px;color:var(--gold,#d4af37);letter-spacing:4px;margin:10px 0 6px}'
    + '#tiMask .ti-hero .slogan{font-size:12.5px;color:var(--sub,#9a8a6a);line-height:1.9;margin-top:6px}'
    + '#tiMask .ti-card{background:#2a2218;border:1px solid #3a2e1e;border-radius:14px;padding:16px;margin-bottom:14px}'
    + '#tiMask .ti-card h2{font-size:15px;color:var(--gold,#d4af37);margin:0 0 12px;letter-spacing:1px}'
    + '#tiMask .ti-row{display:flex;gap:8px;font-size:12.5px;color:#e8dcc8;line-height:1.95;margin:7px 0}'
    + '#tiMask .ti-row .ic{color:var(--gold,#d4af37);font-weight:900;flex-shrink:0}'
    + '#tiMask .ti-row b{color:var(--gold,#d4af37)}'
    + '#tiMask .ti-feegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}'
    + '#tiMask .ti-feeitem{background:#1a1612;border:1px solid #3a2e1e;border-radius:10px;padding:12px 6px;text-align:center}'
    + '#tiMask .ti-feeitem .n{font-size:20px;font-weight:900;color:#4a8}'
    + '#tiMask .ti-feeitem .t{font-size:11px;color:var(--sub,#9a8a6a);margin-top:4px}'
    + '#tiMask .ti-feerow{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px dashed #3a2e1e}'
    + '#tiMask .ti-feerow .k{color:var(--sub,#9a8a6a)}#tiMask .ti-feerow .v{color:#e8dcc8;font-weight:700}'
    + '#tiMask .ti-feerow .v.green{color:#4a8}'
    + '#tiMask .ti-note{font-size:11.5px;color:var(--sub,#9a8a6a);margin-top:9px;line-height:1.7}'
    + '#tiMask .ti-note b{color:var(--gold,#d4af37)}'
    + '#tiMask .ti-enter{width:100%;padding:16px;background:linear-gradient(135deg,#d4af37,#b8912a);color:#0a0e14;border:none;border-radius:12px;font-size:17px;font-weight:900;letter-spacing:3px;cursor:pointer}'
    + '#tiMask .ti-enter:active{opacity:.85}'
    + '#tiMask .ti-ft{text-align:center;font-size:11px;color:var(--sub,#9a8a6a);padding:16px 0 4px}';

  function injectCSS() {
    if (document.getElementById('tiStyle')) return;
    var s = document.createElement('style');
    s.id = 'tiStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  window.ToolIntro = {
    mount: function (cfg) {
      if (!cfg || !cfg.tool) return;
      injectCSS();
      var steps = (cfg.steps || []).map(function (t, i) {
        var mk = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][i] || '·';
        return '<div class="ti-row"><span class="ic">' + mk + '</span><span>' + t + '</span></div>';
      }).join('');

      var mask = document.createElement('div');
      mask.id = 'tiMask';
      mask.innerHTML = ''
        + '<div class="ti-scroll">'
        + '  <div class="ti-top"><button class="ti-back" onclick="ToolIntro.back()">‹ 返回</button></div>'
        + '  <div class="ti-hero">'
        + '    <div class="big">' + esc(cfg.icon || '🔮') + '</div>'
        + '    <h1>' + esc(cfg.title || '') + '</h1>'
        + '    <div class="slogan">' + (cfg.slogan || '') + '</div>'
        + '  </div>'
        + '  <div class="ti-card"><h2>📖 玩法說明</h2>' + steps + '</div>'
        + '  <div class="ti-card">'
        + '    <h2>💰 收費說明</h2>'
        + '    <div class="ti-feegrid">'
        + '      <div class="ti-feeitem"><div class="n">免費</div><div class="t">遊玩積分</div></div>'
        + '      <div class="ti-feeitem"><div class="n">免費</div><div class="t">遊玩道具</div></div>'
        + '      <div class="ti-feeitem"><div class="n">0</div><div class="t">真實消費</div></div>'
        + '    </div>'
        + '    <div class="ti-feerow"><span class="k">當前模式</span><span class="v green">免費娛樂</span></div>'
        + '    <div class="ti-feerow"><span class="k">虛擬道具</span><span class="v green">遊戲內獲取，不可兌換現金</span></div>'
        + (cfg.note ? '<div class="ti-note">' + cfg.note + '</div>' : '')
        + '  </div>'
        + '  <button class="ti-enter">開 始 遊 玩</button>'
        + '  <div class="ti-ft">本遊戲為休閒娛樂 · 不涉及任何真實賭博或金錢兌換</div>'
        + '</div>';

      document.body.appendChild(mask);

      mask.querySelector('.ti-enter').addEventListener('click', function () {
        mask.parentNode && mask.parentNode.removeChild(mask);
        try { if (typeof cfg.onEnter === 'function') cfg.onEnter(); } catch (e) {}
      });
      window.ToolIntro.hide = function () { mask.parentNode && mask.parentNode.removeChild(mask); };
    },
    back: function () {
      var m = document.getElementById('tiMask');
      if (m && m.parentNode) { m.parentNode.removeChild(m); return; }
      location.href = 'home.html';
    }
  };
})();
