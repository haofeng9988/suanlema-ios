/* 游戏统一「退出」浮钮 —— 注入到各游戏页，点击回到游戏大厅 /games
 * 用法：<script src="/game-exit.js?v=20261006" defer></script>
 * 可配置：window.__GAME_LOBBY__ = '/games'（默认大厅）
 */
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function () {
    if (window.__GAME_EXIT_MOUNTED__) return;
    window.__GAME_EXIT_MOUNTED__ = true;
    var lobby = window.__GAME_LOBBY__ || '/games';

    var css = document.createElement('style');
    css.textContent = ''
      + '.game-exit-btn{position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9999;'
      + 'display:inline-flex;align-items:center;gap:5px;padding:9px 15px 9px 12px;border-radius:22px;'
      + 'background:linear-gradient(180deg,rgba(42,34,24,.97),rgba(26,22,18,.97));border:1px solid #d4af37;'
      + 'color:#f5d06f;font-size:13px;font-weight:800;cursor:pointer;'
      + 'box-shadow:0 5px 16px rgba(0,0,0,.5);-webkit-tap-highlight-color:transparent;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}'
      + '.game-exit-btn:active{transform:scale(.94)}'
      + '.game-exit-btn .ge-ic{font-size:16px;line-height:1}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.className = 'game-exit-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '退出游戏，回到大厅');
    btn.innerHTML = '<span class="ge-ic">🏠</span><span>退出游戏</span>';
    btn.addEventListener('click', function () {
      window.location.href = lobby;
    });
    document.body.appendChild(btn);
  });
})();
