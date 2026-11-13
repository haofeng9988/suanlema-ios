/* 游戏「最近玩过」记录 + 展示 —— 共享脚本
 * 用法：
 *   游戏页：<script src="game-recent.js" defer></script>  （自动记录当前游戏）
 *   大厅页：<script src="game-recent.js" defer></script>
 *           GameRecent.render(document.getElementById('recentBox'), {limit:3})
 */
(function () {
  'use strict';
  var KEY = 'hf_recent_games';
  var GAMES = {
    millionaire: { name: '天机百万富翁', art: '💰', url: 'https://tianji.matetechhk.com/millionaire', cls: 'g-millionaire' },
    lingtian:    { name: '灵田天机',     art: '🌾', url: 'https://tianji.matetechhk.com/lingtian',    cls: 'g-lingtian' },
    guacard:     { name: '天机卦卡',     art: '🃏', img: 'tool-icons/guacard-160.png?v=20261030p', url: 'https://tianji.matetechhk.com/guacard',     cls: 'g-guacard' },
    xiuxing:     { name: '天机修行',     art: '🧘', img: 'tool-icons/xiuxing-160.png?v=20261030p', url: 'https://tianji.matetechhk.com/xiuxing',     cls: 'g-xiuxing' },
    wuxing:      { name: '五行消消乐',   art: '🔮', img: 'tool-icons/wuxing-160.png?v=20261030p', url: 'https://tianji.matetechhk.com/wuxing',      cls: 'g-wuxing' },
    bagua:       { name: '八卦解谜',     art: '☯',  img: 'tool-icons/bagua-160.png?v=20261030p', url: 'https://tianji.matetechhk.com/bagua',       cls: 'g-bagua' }
  };
  function pathToSlug(p) {
    p = (p || '').replace(/\/+$/, '');
    var m = {
      '/millionaire': 'millionaire', '/lingtian': 'lingtian', '/lingtian-howto': 'lingtian',
      '/guacard': 'guacard', '/xiuxing': 'xiuxing', '/wuxing': 'wuxing', '/bagua': 'bagua'
    };
    return m[p] || '';
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; }
  }
  function write(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 8))); } catch (e) {}
  }
  function track(slug) {
    if (!slug || !GAMES[slug]) return;
    var rec = read().filter(function (r) { return r.slug !== slug; });
    rec.unshift({ slug: slug, t: Date.now() });
    write(rec);
  }
  function fmtAgo(t) {
    if (!t) return '';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    return Math.floor(s / 86400) + ' 天前';
  }
  function render(box, opt) {
    if (!box) return;
    opt = opt || {};
    var limit = opt.limit || 3;
    var rec = read().filter(function (r) { return GAMES[r.slug]; }).slice(0, limit);
    if (!rec.length) { box.style.display = 'none'; return; }
    var html = '<div class="rc-title">🕐 最近玩过 <span class="rc-hint">点一下继续 →</span></div><div class="rc-row">';
    rec.forEach(function (r) {
      var g = GAMES[r.slug];
      html += '<div class="rc-card" onclick="location.href=\'' + g.url + '\'">'
        + (g.img ? '<span class="rc-art"><img src="' + g.img + '" alt="' + g.name + '"></span>'
                 : '<span class="rc-art">' + g.art + '</span>')
        + '<span class="rc-nm">' + g.name + '</span>'
        + '<span class="rc-ago">' + fmtAgo(r.t) + '</span>'
        + '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    box.style.display = 'block';
  }
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  window.GameRecent = { track: track, render: render, read: read, GAMES: GAMES,
                        clear: function () { write([]); } };
  // 游戏页自动记录（排除大厅/学堂）
  ready(function () {
    var slug = pathToSlug(location.pathname);
    if (slug) track(slug);
  });
})();
