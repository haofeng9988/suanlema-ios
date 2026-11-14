/* 天机工具通用「玩法说明 + 收费说明」落地页组件
 * 用法：ToolIntro.mount({tool:'gaiming', title:'名成利就', icon:'🏮', slogan:'...', steps:[...], note:'...', onEnter:fn})
 * - 落地页作为全屏遮罩覆盖在工具页之上，点「进入工具」后隐藏。
 * - 收费数字实时读 /api/tool/<tool>/access（与后台工具权限配置 + 黑卡剩余联动）。
 */
(function () {
  if (window.ToolIntro) return;

  /* ===== 2026-10-29 第1项：消除「先闪一下游戏主页、再弹说明页」的闪屏 =====
   * 原因：本脚本在 <head> 里加载，但各游戏页要到脚本末尾才调用 ToolIntro.mount()，
   * 中间这段时间（约 1 秒）页面主体已经渲染出来，用户就会看到游戏主页一闪而过。
   * 做法：脚本一执行就先给 <html> 打上 ti-boot 标记，把 body 隐藏（底色为深色，
   * 不会闪白）；等说明页挂载完成的瞬间再摘掉标记。另设 2 秒兜底，
   * 万一某个页面没有调用 mount()，也不会把内容永久藏住。
   */
  function _tiBootOff() {
    try { document.documentElement.className = document.documentElement.className.replace(/\s*ti-boot/g, ''); } catch (e) {}
  }
  // 只有页面显式声明 window.TI_BOOT=1 才套遮罩（index.html 等可能不挂载说明页的页面
  // 绝不套，否则会白屏 2 秒）。游戏页在引入本脚本前设置该标记。
  try {
    if (window.TI_BOOT) {
      document.documentElement.className += ' ti-boot';
      var _bst = document.createElement('style');
      _bst.id = 'tiBootStyle';
      _bst.textContent = 'html.ti-boot{background:#1a1612}html.ti-boot body{visibility:hidden!important}';
      (document.head || document.documentElement).appendChild(_bst);
      setTimeout(_tiBootOff, 2000);
    }
  } catch (e) {}

  // ===== 多语言（共享收费卡 / 落地页文案）=====
  var _TI_DICT = {
    "📖 玩法說明": {en:"📖 How to play",ja:"📖 遊び方",ko:"📖 게임 방법",es:"📖 Cómo jugar",fr:"📖 Comment jouer",de:"📖 Wie man spielt",pt:"📖 Como jogar",ar:"📖 كيفية اللعب",zhTW:"📖 玩法說明",zhHK:"📖 玩法説明"},
    "💰 收费说明": {en:"💰 Pricing",ja:"💰 料金の説明",ko:"💰 요금 안내",es:"💰 Precios",fr:"💰 Tarifs",de:"💰 Preise",pt:"💰 Preços",ar:"💰 الأسعار",zhTW:"💰 收費說明",zhHK:"💰 收費説明"},
    "每次易币": {en:"Yibi/use",ja:"毎回の易コイン",ko:"회당 이코인",es:"Yibi/uso",fr:"Yibi/utilisation",de:"Yibi/Nutzung",pt:"Yibi/uso",ar:"ييبي لكل استخدام",zhTW:"每次易幣",zhHK:"每次易幣"},
    "黑卡每日免费": {en:"Black card free/day",ja:"ブラックカード毎日無料",ko:"블랙카드 일일 무료",es:"Tarjeta negra gratis/día",fr:"Carte noire gratuite/jour",de:"Black Card gratis/Tag",pt:"Cartão preto grátis/dia",ar:"البطاقة السوداء مجانًا/يوم",zhTW:"黑卡每日免費",zhHK:"黑卡每日免費"},
    "进 入 工 具": {en:"ENTER TOOL",ja:"ツールを開く",ko:"도구 열기",es:"ENTRAR",fr:"ENTRER",de:"WERKZEUG ÖFFNEN",pt:"ENTRAR",ar:"دخول الأداة",zhTW:"進 入 工 具",zhHK:"進 入 工 具"},
    "命理仅供文化参考 · 命由己造 · 福自己求": {en:"For cultural reference only · destiny is self-made · blessings are sought by oneself",ja:"運命学は文化の参考のみ · 運命は自ら切り開く · 福は自ら求める",ko:"명리는 문화적 참고용 · 운명은 스스로 개척 · 복은 스스로 구함",es:"La numerología es solo referencia cultural · El destino se forja uno mismo",fr:"Référence culturelle uniquement · Le destin se forge soi-même",de:"Nur zur kulturellen Referenz · Schicksal gestaltet man selbst",pt:"Apenas referência cultural · O destino é construído por si",ar:"مرجع ثقافي فقط · القدر يصنعه الإنسان بنفسه",zhTW:"命理僅供文化參考 · 命由己造 · 福自己求",zhHK:"命理僅供文化參考 · 命由己造 · 福自己求"},
    "‹ 天机": {en:"‹ Tianji",ja:"‹ 天機",ko:"‹ 천기",es:"‹ Tianji",fr:"‹ Tianji",de:"‹ Tianji",pt:"‹ Tianji",ar:"‹ تياني",zhTW:"‹ 天機",zhHK:"‹ 天機"},
    "‹ 返回": {en:"‹ Back",ja:"‹ 戻る",ko:"‹ 뒤로",es:"‹ Atrás",fr:"‹ Retour",de:"‹ Zurück",pt:"‹ Voltar",ar:"‹ رجوع",zhTW:"‹ 返回",zhHK:"‹ 返回"},
    "我的易币": {en:"My Yibi",ja:"マイ易コイン",ko:"내 이코인",es:"Mis Yibi",fr:"Mes Yibi",de:"Meine Yibi",pt:"Meus Yibi",ar:"ييبي الخاص بي",zhTW:"我的易幣",zhHK:"我的易幣"},
    "余额不足": {en:"Insufficient balance",ja:"残高不足",ko:"잔액 부족",es:"Saldo insuficiente",fr:"Solde insuffisant",de:"Guthaben unzureichend",pt:"Saldo insuficiente",ar:"الرصيد غير كافٍ",zhTW:"餘額不足",zhHK:"餘額不足"},
    "还差": {en:"short by",ja:"不足",ko:"부족액",es:"faltan",fr:"manque",de:"fehlen",pt:"faltam",ar:"ينقص",zhTW:"還差",zhHK:"還差"},
    "去购买易币": {en:"Buy Yibi",ja:"易コインを購入",ko:"이코인 구매",es:"Comprar Yibi",fr:"Acheter des Yibi",de:"Yibi kaufen",pt:"Comprar Yibi",ar:"شراء ييبي",zhTW:"去購買易幣",zhHK:"去購買易幣"},
    "余额充足": {en:"Balance sufficient",ja:"残高十分",ko:"잔액 충분",es:"Saldo suficiente",fr:"Solde suffisant",de:"Guthaben ausreichend",pt:"Saldo suficiente",ar:"الرصيد كافٍ",zhTW:"餘額充足",zhHK:"餘額充足"},
    "当前状态": {en:"Status",ja:"現在の状態",ko:"현재 상태",es:"Estado",fr:"Statut",de:"Status",pt:"Estado",ar:"الحالة",zhTW:"當前狀態",zhHK:"當前狀態"},
    "该工具已停用": {en:"This tool is disabled",ja:"このツールは停止中",ko:"이 도구는 중지됨",es:"Esta herramienta está deshabilitada",fr:"Cet outil est désactivé",de:"Dieses Werkzeug ist deaktiviert",pt:"Esta ferramenta está desativada",ar:"هذه الأداة معطلة",zhTW:"該工具已停用",zhHK:"該工具已停用"},
    "当前模式": {en:"Current mode",ja:"現在のモード",ko:"현재 모드",es:"Modo actual",fr:"Mode actuel",de:"Aktueller Modus",pt:"Modo atual",ar:"الوضع الحالي",zhTW:"當前模式",zhHK:"當前模式"},
    "免费使用": {en:"Free to use",ja:"無料で利用",ko:"무료 사용",es:"Uso gratuito",fr:"Utilisation gratuite",de:"Kostenlos nutzen",pt:"Uso gratuito",ar:"استخدام مجاني",zhTW:"免費使用",zhHK:"免費使用"},
    "免费预览（部分内容）": {en:"Free preview (partial)",ja:"無料プレビュー（一部）",ko:"무료 미리보기(일부)",es:"Vista previa gratis (parcial)",fr:"Aperçu gratuit (partiel)",de:"Kostenvorschau (teilweise)",pt:"Prévia grátis (parcial)",ar:"معاينة مجانية (جزئية)",zhTW:"免費預覽（部分內容）",zhHK:"免費預覽（部分內容）"},
    "每次消耗": {en:"Cost per use",ja:"毎回の消費",ko:"회당 소모",es:"Costo por uso",fr:"Coût par utilisation",de:"Kosten pro Nutzung",pt:"Custo por uso",ar:"التكلفة لكل استخدام",zhTW:"每次消耗",zhHK:"每次消耗"},
    "需付费": {en:"Paid",ja:"有料",ko:"유료",es:"De pago",fr:"Payant",de:"Kostenpflichtig",pt:"Pago",ar:"مدفوع",zhTW:"需付費",zhHK:"需付費"},
    "黑卡今日剩余": {en:"Black card left today",ja:"ブラックカード本日の残り",ko:"블랙카드 오늘 남음",es:"Tarjeta negra restante hoy",fr:"Carte noire restante aujourd'hui",de:"Black Card heute übrig",pt:"Cartão preto restante hoje",ar:"المتبقي من البطاقة السوداء اليوم",zhTW:"黑卡今日剩餘",zhHK:"黑卡今日剩餘"},
    "黑卡会员": {en:"Black card member",ja:"ブラックカード会員",ko:"블랙카드 회원",es:"Miembro tarjeta negra",fr:"Membre carte noire",de:"Black-Card-Mitglied",pt:"Membro cartão preto",ar:"عضو البطاقة السوداء",zhTW:"黑卡會員",zhHK:"黑卡會員"},
    "免费": {en:"Free",ja:"無料",ko:"무료",es:"Gratis",fr:"Gratuit",de:"Gratis",pt:"Grátis",ar:"مجانًا",zhTW:"免費",zhHK:"免費"},
    "次": {en:"use(s)",ja:"回",ko:"회",es:"uso(s)",fr:"fois",de:"Mal",pt:"vez(es)",ar:"مرة",zhTW:"次",zhHK:"次"},
    "每日免": {en:"Free",ja:"毎日無料",ko:"매일 무료",es:"Gratis",fr:"Gratuit",de:"Gratis",pt:"Grátis",ar:"مجانًا",zhTW:"每日免",zhHK:"每日免"},
    "易币": {en:"Yibi",ja:"易コイン",ko:"이코인",es:"Yibi",fr:"Yibi",de:"Yibi",pt:"Yibi",ar:"ييبي",zhTW:"易幣",zhHK:"易幣"}
  };
  function _tiLang(){ try { var l=localStorage.getItem('yx_lang')||'zh'; return (window.YX_normalizeLang?window.YX_normalizeLang(l):(l==='en'?'en':'zh')); } catch (e) { return 'zh'; } }
  function _tiT(s){
    if (_tiLang() === 'zh') return s;
    var e = _TI_DICT[s]; if (!e) return s;
    var L = _tiLang();
    return e[L] !== undefined ? e[L] : (L === 'zhHK' && e.zhTW !== undefined ? e.zhTW : (L === 'zhTW' && e.zhHK !== undefined ? e.zhHK : (e.en !== undefined ? e.en : s)));
  }
  function _tiFree(n){ return _tiLang() === 'zh' ? ('每日免 ' + n + ' 次') : (_tiT('每日免') + ' ' + n + (_tiLang() === 'ja' ? '回' : (_tiLang() === 'ko' ? '회' : ' use(s)'))); }

  var CSS = ''
    + '#tiMask{position:fixed;inset:0;z-index:9000;background:var(--bg,#1a1612);overflow-y:auto;-webkit-overflow-scrolling:touch}'
    + '#tiMask .ti-scroll{max-width:500px;margin:0 auto;padding:12px 12px 8px}'
    + '#tiMask .ti-top{position:sticky;top:0;z-index:3;padding:5px 0;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(26,22,18,.85));display:flex;align-items:center}'
    + '#tiMask .ti-back{color:var(--gold,#d4af37);text-decoration:none;font-size:13px;border:1px solid var(--gold,#d4af37);border-radius:8px;padding:4px 11px;line-height:1}'
    + '#tiMask .ti-hero{text-align:center;padding:14px 12px;background:linear-gradient(180deg,#2a2218,#1a1612);border:1px solid #3a2e1e;border-radius:14px;margin-bottom:10px}'
    + '#tiMask .ti-hero .big{font-size:34px;line-height:1}'
    + '#tiMask .ti-hero h1{font-size:20px;color:var(--gold,#d4af37);letter-spacing:2px;margin:5px 0 3px}'
    + '#tiMask .ti-hero .slogan{font-size:12px;color:var(--sub,#9a8a6a);line-height:1.65;margin-top:4px}'
    + '#tiMask .ti-card{background:#2a2218;border:1px solid #3a2e1e;border-radius:12px;padding:12px;margin-bottom:10px}'
    + '#tiMask .ti-card h2{font-size:14px;color:var(--gold,#d4af37);margin:0 0 8px;letter-spacing:1px}'
    + '#tiMask .ti-row{display:flex;gap:7px;font-size:12px;color:#e8dcc8;line-height:1.65;margin:5px 0}'
    + '#tiMask .ti-row .ic{color:var(--gold,#d4af37);font-weight:900;flex-shrink:0}'
    + '#tiMask .ti-row b{color:var(--gold,#d4af37)}'
    + '#tiMask .ti-feegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}'
    + '#tiMask .ti-feeitem{background:#1a1612;border:1px solid #3a2e1e;border-radius:9px;padding:8px 4px;text-align:center}'
    + '#tiMask .ti-feeitem .n{font-size:17px;font-weight:900;color:var(--gold,#d4af37)}'
    + '#tiMask .ti-feeitem .n.green{color:#4a8}'
    + '#tiMask .ti-feeitem .t{font-size:10.5px;color:var(--sub,#9a8a6a);margin-top:2px}'
    + '#tiMask .ti-feerow{display:flex;justify-content:space-between;font-size:11.5px;padding:4px 0;border-bottom:1px dashed #3a2e1e}'
    + '#tiMask .ti-feerow .k{color:var(--sub,#9a8a6a)}#tiMask .ti-feerow .v{color:#e8dcc8;font-weight:700}'
    + '#tiMask .ti-feerow .v.hl{color:var(--gold,#d4af37)}#tiMask .ti-feerow .v.green{color:#4a8}'
    + '#tiMask .ti-note{font-size:11px;color:var(--sub,#9a8a6a);margin-top:7px;line-height:1.6}'
    + '#tiMask .ti-note b{color:var(--gold,#d4af37)}'
    // 进入按钮：吸底常驻，保证任何屏幕都完整可见可点
    + '#tiMask .ti-enterwrap{position:sticky;bottom:0;z-index:4;padding:8px 0 10px;background:linear-gradient(0deg,var(--bg,#1a1612) 65%,rgba(26,22,18,0))}'
    + '#tiMask .ti-enter{width:100%;padding:14px;background:linear-gradient(135deg,#d4af37,#b8912a);color:#0a0e14;border:none;border-radius:12px;font-size:16px;font-weight:900;letter-spacing:3px;cursor:pointer;box-shadow:0 -2px 16px rgba(0,0,0,.5)}'
    + '#tiMask .ti-enter:active{opacity:.85}'
    + '#tiMask .ti-ft{text-align:center;font-size:10.5px;color:var(--sub,#9a8a6a);padding:8px 0 2px}';

  function injectCSS() {
    if (document.getElementById('tiStyle')) return;
    var s = document.createElement('style');
    s.id = 'tiStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function tok() { try { return localStorage.getItem('yx_tk') || ''; } catch (e) { return ''; } }
  function api() { try { return localStorage.getItem('yx_api') || ''; } catch (e) { return ''; } }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  // 2026-11-04 单一数据源：余额统一读 /api/yibi/wallet（与钱包页、个人中心、徽章同源）
  function fetchBalance() {
    return fetch(api() + '/api/yibi/wallet', { headers: tok() ? { 'X-Token': tok() } : {} })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.ok === false) return null;
        if (typeof d.yibi === 'number') return d.yibi;
        return null;
      })
      .catch(function () { return null; });
  }

  function fillFees(mask, tool) {
    var yb = mask.querySelector('.ti-v-yibi'),
        blk = mask.querySelector('.ti-v-black'), rows = mask.querySelector('.ti-feerows');
    var st = { mode: '', cost: 0, blackFree: 0, remain: 0, isBlack: false, bal: null, ready: false,
               vipLevel: 0, quota: 0, quotaExp: '', unlExp: '' };

    function rowsHTML() {
      var R = [];
      // mode 取值：off | free | preview | vip(黑卡无限) | vipq(会员赠送次数) | points/coins/mix
      if (st.mode === 'off') R.push({ k: '当前状态', v: '该工具已停用', c: '' });
      else if (st.mode === 'free') R.push({ k: '当前模式', v: '免费使用', c: 'green' });
      else if (st.mode === 'preview') R.push({ k: '当前模式', v: '免费预览（部分内容）', c: 'green' });
      else if (st.mode === 'vip') R.push({ k: '当前模式', v: '黑卡会员 · 工具不限次', c: 'green' });
      else if (st.mode === 'vipq') R.push({ k: '当前模式', v: '会员赠送次数 · 不扣易币', c: 'green' });
      else if (st.mode === 'black') R.push({ k: '当前模式', v: '黑卡免费用', c: 'green' });
      // 2026-11-14 老板定案：易币不能用于任何工具，须订阅或买能量包
      else if (st.mode === 'need_sub') R.push({ k: '当前模式', v: '需开通会员或购买工具能量包', c: 'hl' });
      if (st.mode === 'need_sub') {
        html += '<div style="margin-top:8px;padding:8px 10px;border:1px solid rgba(212,175,55,.55);border-radius:9px;background:rgba(212,175,55,.08);font-size:12px;color:#e8dcc8;line-height:1.7">'
          + _tiT('工具仅限会员订阅赠送次数或工具能量包使用，易币不可用于工具。')
          + '<div style="margin-top:6px"><a href="/vip" style="display:inline-block;padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,#8a6a24,#c9922f);color:#fff;font-weight:900;text-decoration:none">' + _tiT('去开通会员') + '</a></div></div>';
      }
      else R.push({ k: '每次消耗', v: (st.cost ? st.cost + ' ' + _tiT('易币') : _tiT('需付费')), c: 'hl' });

      // 订阅赠送次数 / 黑卡有效期（2026-11-13 三层体系）
      if (st.vipLevel >= 3 && st.unlExp) {
        R.push({ k: '黑卡会员', v: _tiT('有效期至') + ' ' + st.unlExp.slice(0, 10), c: 'hl' });
      } else if (st.quota > 0) {
        R.push({ k: '会员剩余次数', v: st.quota + ' ' + _tiT('次'), c: 'green' });
        if (st.quotaExp) R.push({ k: '次数有效期', v: st.quotaExp.slice(0, 10), c: '' });
      }
      if ((st.isBlack || st.mode === 'black') && st.blackFree > 0) R.push({ k: '黑卡今日剩余', v: st.remain + ' ' + _tiT('次'), c: 'green' });

      if (st.bal !== null) R.push({ k: '我的易币', v: st.bal, c: (st.cost > 0 && st.bal < st.cost) ? 'red' : '' });

      var html = R.map(function (r) {
        return '<div class="ti-feerow"><span class="k">' + esc(_tiT(r.k)) + '</span><span class="v ' + (r.c || '') + '">' + esc(_tiT(r.v)) + '</span></div>';
      }).join('');

      // 余额不足：明示差额 + 引导购买
      // 2026-11-14：need_sub 模式不引导买易币（易币不能用于工具）
      var _yibiAllowed = (st.mode === 'points' || st.mode === 'coins' || st.mode === 'mix');
      if (st.ready && st.cost > 0 && st.bal !== null && st.bal < st.cost && _yibiAllowed && !st.isBlack) {
        var diff = st.cost - st.bal;
        html += '<div class="ti-short" style="margin-top:8px;padding:8px 10px;border:1px solid rgba(224,100,79,.55);border-radius:9px;background:rgba(224,100,79,.10);font-size:12.5px;color:#f0b3a6;line-height:1.6">'
          + '⚠️ ' + _tiT('余额不足') + '，' + _tiT('还差') + ' <b style="color:#ff8f76">' + diff + '</b> ' + _tiT('易币')
          + '<div style="margin-top:6px"><a href="/mall" style="display:inline-block;padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,#8a6a24,#c9922f);color:#fff;font-weight:900;text-decoration:none">' + _tiT('去购买易币') + '</a></div>'
          + '</div>';
      }

      // 余额充足提示（实时同步反馈）
      if (st.ready && st.cost > 0 && st.bal !== null && st.bal >= st.cost && _yibiAllowed && !st.isBlack) {
        html += '<div style="margin-top:6px;font-size:11.5px;color:#7bd88a">✓ ' + _tiT('余额充足') + '</div>';
      }
      return html;
    }

    function paint() {
      if (!rows) return;
      rows.innerHTML = rowsHTML();
    }

    function loadBalance() {
      return fetchBalance().then(function (v) {
        if (v !== null) { st.bal = v; st.ready = true; paint(); }
        return v;
      });
    }

    // 1) 工具权限/价格
    fetch(api() + '/api/tool/' + tool + '/access', { headers: tok() ? { 'X-Token': tok() } : {} })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.access) return;
        var a = d.access;
        st.mode = a.mode || '';
        st.cost = a.yibi_cost || a.points_cost || 0;
        st.blackFree = a.black_free || 0;
        st.remain = a.black_remain || 0;
        st.isBlack = !!a.is_black;
        // 2026-11-13 老板三层体系：0=游客 / 1=VIP(月卡年卡) / 3=黑卡($99.99工具包)
        st.vipLevel = a.vip_level || 0;
        st.quota = a.quota_remain || 0;
        st.quotaExp = a.quota_expire || '';
        st.unlExp = a.unlimited_expire || '';
        var _free = _tiT('免费');
        if (yb) {
          if (st.mode === 'need_sub') { yb.textContent = _tiT('需开通'); }
          else { yb.textContent = st.cost > 0 ? st.cost : (['free','vip','vipq'].indexOf(st.mode) >= 0 ? _free : '--'); }
        }
        // 第二张卡按身份显示，绝不给普通用户看假次数
        var _bt = mask.querySelector('.ti-v-blackt');
        var _yt = mask.querySelector('.ti-v-yibit');
        if (_yt) _yt.textContent = (st.mode === 'need_sub') ? _tiT('工具资格') : _tiT('每次易币');
        if (st.vipLevel >= 3 && st.unlExp) {
          if (blk) blk.textContent = st.unlExp.slice(0, 10);
          if (_bt) _bt.textContent = _tiT('黑卡有效期');
        } else if (st.quota > 0) {
          if (blk) blk.textContent = st.quota;
          if (_bt) _bt.textContent = _tiT('会员剩余次数');
        } else if ((st.isBlack || st.mode === 'black') && st.blackFree > 0) {
          if (blk) blk.textContent = st.remain;
          if (_bt) _bt.textContent = _tiT('黑卡今日剩余');
        } else {
          if (blk) blk.textContent = '--';
          if (_bt) _bt.textContent = _tiT('黑卡每日免费');
        }
        st.ready = false;
        paint();
        loadBalance();
      }).catch(function () {});

    // 2) 进入即拉一次余额（未登录也能拿到 0，仅作展示）
    loadBalance();

    // 3) 停留期间动态刷新：页面重新可见 / 聚焦 / 每 20 秒
    var _onVis = function () { if (document.visibilityState === 'visible') loadBalance(); };
    var _onFocus = function () { loadBalance(); };
    try {
      document.addEventListener('visibilitychange', _onVis);
      window.addEventListener('focus', _onFocus);
    } catch (e) {}
    var _timer = setInterval(loadBalance, 20000);

    // 4) 关闭弹窗时清理监听，避免泄漏
    var _origHide = window.ToolIntro && window.ToolIntro.hide;
    function cleanup() {
      try { document.removeEventListener('visibilitychange', _onVis); window.removeEventListener('focus', _onFocus); } catch (e) {}
      clearInterval(_timer);
    }
    mask.__tiCleanup = cleanup;
    try {
      var _obs = new MutationObserver(function () {
        if (!document.body.contains(mask)) { cleanup(); _obs.disconnect(); }
      });
      _obs.observe(document.body, { childList: true });
    } catch (e) {}
  }

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
        + '  <div class="ti-top"><a class="ti-back" href="/xuetang#tianji">' + _tiT('‹ 返回') + '</a></div>'
        + '  <div class="ti-hero">'
        + '    <div class="big">' + esc(cfg.icon || '🔮') + '</div>'
        + '    <h1>' + esc(cfg.title || '') + '</h1>'
        + '    <div class="slogan">' + (cfg.slogan || '') + '</div>'
        + '  </div>'
        + '  <div class="ti-card"><h2>' + _tiT('📖 玩法說明') + '</h2>' + steps + '</div>'
        + '  <div class="ti-card">'
        + '    <h2>' + _tiT('💰 收费说明') + '</h2>'
        + '    <div class="ti-feegrid" style="grid-template-columns:1fr 1fr">'
        + '      <div class="ti-feeitem"><div class="n ti-v-yibi">--</div><div class="t ti-v-yibit">' + _tiT('每次易币') + '</div></div>'
        + '      <div class="ti-feeitem"><div class="n green ti-v-black">--</div><div class="t ti-v-blackt">' + _tiT('黑卡每日免费') + '</div></div>'
        + '    </div>'
        + '    <div class="ti-feerows"></div>'
        + (cfg.note ? '<div class="ti-note">' + cfg.note + '</div>' : '')
        + '  </div>'
        + '  <div class="ti-enterwrap"><button class="ti-enter">' + _tiT('进 入 工 具') + '</button></div>'
        + '  <div class="ti-ft">' + _tiT('命理仅供文化参考 · 命由己造 · 福自己求') + '</div>'
        + '</div>';

      document.body.appendChild(mask);
      _tiBootOff();
      fillFees(mask, cfg.tool);

      // 2026-11-04 返回逻辑：优先回退上一页，无历史才回工具主页
      var _bk = mask.querySelector('.ti-back');
      if (_bk) {
        _bk.addEventListener('click', function (e) {
          try {
            if (window.history && window.history.length > 1) {
              e.preventDefault();
              window.history.back();
              return;
            }
          } catch (err) {}
          // 无历史栈：保留 href 默认跳转 /xuetang#tianji
        });
      }
      mask.querySelector('.ti-enter').addEventListener('click', function () {
        mask.parentNode && mask.parentNode.removeChild(mask);
        try { if (typeof cfg.onEnter === 'function') cfg.onEnter(); } catch (e) {}
      });
      // 供页面程序化隐藏
      window.ToolIntro.hide = function () { mask.parentNode && mask.parentNode.removeChild(mask); };
    }
  };
})();
