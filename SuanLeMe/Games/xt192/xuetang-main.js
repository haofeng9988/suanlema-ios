/* 学堂主逻辑（原内联于 xuetang.html，抽出以便缓存） */
const API='';
/* 首期只预告：改 true 即全量开放，无需发版 */
var COURSE_ONLINE=false;
/* ===== 原生弹窗兜底（iOS WKWebView 未实现 alert/confirm/prompt 回调时，window.alert 等会静默失效）===== */
(function(){
  var NEEDS=false;
  try{
    // 探测：原生 confirm 若被实现，调用会阻塞；WKWebView 未实现时直接返回且无 UI
    // 用一个小技巧：检测是否在 iOS WKWebView（有 webkit.messageHandlers）或自定义 UA
    var ua=navigator.userAgent||'';
    if((/SuanLeMeApp/i.test(ua))||(window.webkit&&window.webkit.messageHandlers)){
      NEEDS=true;
    }
  }catch(e){}
  function box(title,msg,input,onOk){
    try{
      var m=document.getElementById('__dlgModal');
      if(!m){
        m=document.createElement('div');
        m.id='__dlgModal';
        m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:9999;justify-content:center;align-items:center;padding:20px';
        m.innerHTML='<div style="background:#241d14;border:2px solid #d4af37;border-radius:16px;padding:22px;max-width:88vw;width:340px">'+
          '<div id="__dlgTitle" style="color:#d4af37;font-size:16px;font-weight:700;margin-bottom:10px"></div>'+
          '<div id="__dlgMsg" style="color:#e8dcc8;font-size:14px;line-height:1.7;margin-bottom:14px;white-space:pre-wrap;word-break:break-word"></div>'+
          '<input id="__dlgInput" style="display:none;width:100%;padding:10px;margin-bottom:12px;background:#1a1612;border:1px solid #3a2e1e;border-radius:8px;color:#e8dcc8;font-size:16px">'+
          '<div style="display:flex;gap:10px">'+
          '<button id="__dlgOk" style="flex:1;padding:12px;background:#d4af37;color:#1a1612;border:none;border-radius:8px;font-size:15px;font-weight:700">确定</button>'+
          '<button id="__dlgCancel" style="flex:1;padding:12px;background:transparent;border:2px solid #d4af37;color:#d4af37;border-radius:8px;font-size:15px;font-weight:700">取消</button>'+
          '</div></div>';
        document.body.appendChild(m);
      }
      var b=document.getElementById('__dlgCancel');
      var inp=document.getElementById('__dlgInput');
      document.getElementById('__dlgTitle').textContent=title||'';
      document.getElementById('__dlgMsg').textContent=msg||'';
      if(input){
        inp.style.display='block'; inp.value='';
      }else{
        inp.style.display='none';
      }
      b.style.display=(onOk===null)?'none':'block';
      document.getElementById('__dlgOk').onclick=function(){
        m.style.display='none';
        if(onOk)onOk(input?inp.value:true);
      };
      b.onclick=function(){
        m.style.display='none';
        if(onOk)onOk(false);
      };
      m.style.display='flex';
    }catch(e){
      // 兜底
      if(onOk)onOk(input?null:true);
    }
  }
  var nAlert=window.alert;
  window.alert=function(msg){
    if(!NEEDS){return nAlert.apply(window,arguments);}
    box('提示',String(msg==null?'':msg),false,function(){});
  };
  // confirm/prompt 无法同步阻塞；提供异步版 window.__confirm(msg, cb)
  window.__confirm=function(msg,cb){ box('确认',String(msg==null?'':msg),false,function(v){ if(cb)cb(v===true); }); };
})();
let TOKEN=localStorage.getItem('yx_tk')||'';
// 2026-10-31 算了吗第8项：已登录用户从邀请链接/待恢复房间进入时，
// 页面加载即回房间（覆盖「已登录但没走登录弹窗」的场景）。
setTimeout(function(){
  try{
    if(!TOKEN) return;
    var _pr=sessionStorage.getItem('ml_pending_room')||'';
    if(_pr){ location.href='https://tianji.matetechhk.com/millionaire?room='+_pr; }
  }catch(e){}
}, 120);
// 从 cookie 恢复 token（保持登录，双保险）
if(!TOKEN){
  let m=document.cookie.match(/(?:^|;\s*)yx_tk=([^;]+)/);
  if(m){TOKEN=m[1];localStorage.setItem('yx_tk',TOKEN);}
}
let USER=null;
let currentCat='';

// ===== 维护公告横幅 =====
function toggleMtDetail(){
  let d=document.getElementById('mtBannerDetail');
  let a=document.getElementById('mtBannerArrow');
  if(d.style.display==='none'){d.style.display='block';a.textContent='▴';}
  else{d.style.display='none';a.textContent='▾';}
}
async function checkMaintenanceBanner(){
  try{
    let r=await fetch(API+'/api/maintenance/status').then(r=>r.json());
    if(!r.ok||!r.maintenance)return;
    let m=r.maintenance;
    if(!m.enabled)return;
    // 管理员不显示横幅（管理员可正常使用）
    if(USER&&USER.role&&(USER.role==='admin'||USER.role==='superadmin'))return;
    let banner=document.getElementById('mtBanner');
    let titleEl=document.getElementById('mtBannerTitle');
    let timeEl=document.getElementById('mtBannerTime');
    let contentEl=document.getElementById('mtBannerContent');
    titleEl.textContent=m.title||'系统维护中';
    let timeStr='';
    if(m.start_time&&m.end_time)timeStr='维护时间：'+m.start_time+' ~ '+m.end_time;
    else if(m.until)timeStr='预计恢复：'+m.until;
    timeEl.textContent=timeStr;
    contentEl.textContent=m.content||'系统正在进行升级维护，请稍后再来。';
    banner.style.display='block';
  }catch(e){}
}
checkMaintenanceBanner();

// ===== 首页多语言引擎（8 大语言）=====
function xtGetLang(){
  // 优先级：URL ?lang=xx > localStorage > 默认 zh
  try{
    const u=new URLSearchParams(location.search).get('lang');
    if(u && ((window.XT_I18N||{})[u])) return u;
  }catch(e){}
  var _l=localStorage.getItem('yx_lang')||'zh'; return (window.YX_normalizeLang||window.XT_normalizeLang)?(window.YX_normalizeLang||window.XT_normalizeLang)(_l):(_l==='en'?'en':'zh');
}
function xtT(key){
  const L=window.XT_I18N||{}, lang=xtGetLang();
  const d=L[lang]||L.zh||{};
  return (d[key]!==undefined)?d[key]:((L.zh&&L.zh[key]!==undefined)?L.zh[key]:key);
}
function xtApplyI18n(){
  const lang=xtGetLang();
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.getAttribute('data-i18n'); const v=xtT(k);
    if(v!==undefined) el.textContent=v;
  });
  const rtl=(window.XT_RTL||[]).includes(lang);
  document.documentElement.setAttribute('dir', rtl?'rtl':'ltr');
  document.documentElement.setAttribute('lang', lang);
  const sel=document.getElementById('xtLangSel');
  if(sel && sel.value!==lang) sel.value=lang;
}
function xtSetLang(lang){
  localStorage.setItem('yx_lang', lang);
  xtApplyI18n();
  // Reload to re-run TIPatch and re-render all text with new language
  setTimeout(function(){ location.reload(); }, 80);
}
function xtInitI18n(){
  const sel=document.getElementById('xtLangSel');
  if(sel && !sel.dataset.filled){
    (window.XT_LANGS||[['zh','简体中文']]).forEach(([v,label])=>{
      const o=document.createElement('option'); o.value=v; o.textContent=label; sel.appendChild(o);
    });
    sel.dataset.filled='1';
  }
  xtApplyI18n();
}
xtInitI18n();
let currentCourse=null;
const CATS=['八字','紫微','六爻','奇门','风水','免费'];
const CAT_ICON={'八字':'📊','紫微':'🌟','六爻':'🪙','奇门':'🗺️','风水':'🧭','免费':'🎁','合婚':'💑','起名':'🎨','择日':'📅','奇门遁甲':'🗝️'};
const TYPE_NAME={video:'视频课',audio:'音频课',article:'图文课'};

/* ===== 课程模块开关见文件顶部 COURSE_ONLINE：首期只做预告 ===== */
const SOON_CATS=['易学文化','八字','紫微','奇门','风水','流年'];
const SOON_CAT_ICON={'易学文化':'📖','八字':'📊','紫微':'🌟','奇门':'🗺️','风水':'🧭','流年':'📅'};
const SOON_I18N={
  course_soon:{zh:'课程即将上线，敬请期待',zhTW:'課程即將上線，敬請期待',zhHK:'課程即將上線，敬請期待',en:'Courses coming soon. Stay tuned!'},
  course_not_open:{zh:'该课程暂未开放',zhTW:'該課程暫未開放',zhHK:'該課程暫未開放',en:'This course is not available yet'},
  soon_prefix:{zh:'首期预告',zhTW:'首期預告',zhHK:'首期預告',en:'Coming soon'},
  all_cats:{zh:'全部',zhTW:'全部',zhHK:'全部',en:'All'},
  '易学文化':{zh:'易学文化',zhTW:'易學文化',zhHK:'易學文化',en:'Yi Studies Culture'},
  '八字':{zh:'八字',zhTW:'八字',zhHK:'八字',en:'BaZi'},
  '紫微':{zh:'紫微',zhTW:'紫微',zhHK:'紫微',en:'Zi Wei'},
  '奇门':{zh:'奇门',zhTW:'奇門',zhHK:'奇門',en:'Qi Men'},
  '风水':{zh:'风水',zhTW:'風水',zhHK:'風水',en:'Feng Shui'},
  '流年':{zh:'流年',zhTW:'流年',zhHK:'流年',en:'Annual Fortune'}
};
function soonT(k){
  var d=SOON_I18N[k]||{};
  var lang=(typeof xtGetLang==='function')?xtGetLang():'zh';
  if(d[lang])return d[lang];
  if(lang==='zh'||lang==='zhTW'||lang==='zhHK')return d.zh||k;
  return d.en||d.zh||k;
}
function courseSoonBox(){return document.getElementById('courseSoonPlaceholder');}
function showCourseSoon(msgKey,cat){
  var box=courseSoonBox(); if(!box)return;
  var ct=document.getElementById('courseSoonCat'), tx=document.getElementById('courseSoonText');
  if(ct)ct.textContent=cat?soonT(cat):soonT('soon_prefix');
  if(tx)tx.textContent=soonT(msgKey||'course_soon');
  box.style.display='block';
  var cl=document.getElementById('courseList'); if(cl){cl.innerHTML='';cl.style.display='none';}
  var fs=document.getElementById('homeFreeSection'); if(fs)fs.style.display='none';
}
function hideCourseSoon(){var b=courseSoonBox(); if(b)b.style.display='none';}
function courseNotOpen(){
  try{
    var qs=(location.search||'').replace(/^\?/,'').split('&').filter(function(x){return x&&!/^(cid|course_id|course)=/i.test(x);}).join('&');
    history.replaceState(null,'',location.pathname+(qs?('?'+qs):''));
  }catch(e){}
  if(typeof switchMainTab==='function')switchMainTab('course');
  showCourseSoon('course_not_open','');
  try{window.scrollTo({top:0,behavior:'instant'});}catch(e){}
}

// 首页 Banner 轮播（优先数据库 banners 表，无则用内置默认）
const HOME_BANNERS=[
  {title:'八字命盘精讲',sub:'从入门到实战 · 7 天掌握',art:'☯',cat:'八字'},
  {title:'紫微斗数十四主星',sub:'看懂自己的人生剧本',art:'🌟',cat:'紫微'},
  {title:'奇门遁甲决策',sub:'转盘占卜 · 算了吗大师解盘',art:'🗺️',cat:'奇门'},
  {title:'家居旺运布局',sub:'让家变成你的能量场',art:'🏮',cat:'风水'},
];
let _bIdx=0;let _bTimer=null;let _banners=[];

async function loadBanners(){
  try{
    let r=await fetch(API+'/api/banners').then(r=>r.json());
    if(r.ok&&r.items&&r.items.length>0){
      _banners=r.items.map(b=>({
        title:b.title,sub:b.subtitle,art:null,
        image:b.image||'',cat:b.link_cat||'',url:b.link_url||''
      }));
    }
  }catch(e){}
  if(_banners.length===0){_banners=HOME_BANNERS.slice();}
  renderBanner();
  startBannerTimer();
}

function h(){return TOKEN?{'X-Token':TOKEN}:{}}

function renderCats(){
  if(!COURSE_ONLINE){
    var tabs=document.getElementById('cats');
    if(tabs){
      var th='<button class="'+(currentCat===''?'active':'')+'" onclick="setCat(\'\')">'+soonT('all_cats')+'</button>';
      SOON_CATS.forEach(function(c){
        th+='<button class="'+(currentCat===c?'active':'')+'" onclick="setCat(\''+c+'\')">'+(SOON_CAT_ICON[c]||'📚')+' '+soonT(c)+'</button>';
      });
      tabs.innerHTML=th;
    }
    var hc0=document.getElementById('homeCats');
    if(hc0){
      hc0.innerHTML=SOON_CATS.map(function(c){
        return '<div class="home-cat-item" onclick="setCat(\''+c+'\')"><div class="ic">'+(SOON_CAT_ICON[c]||'📚')+'</div><div class="lb">'+soonT(c)+'</div></div>';
      }).join('');
    }
    return;
  }
  let html=`<button class="${currentCat===''?'active':''}" onclick="setCat('')">全部</button>`;
  CATS.forEach(c=>{
    html+=`<button class="${currentCat===c?'active':''}" onclick="setCat('${c}')">${CAT_ICON[c]||''} ${c}</button>`;
  });
  document.getElementById('cats').innerHTML=html;
  // 同时渲染顶部横向分类图标
  let hc=document.getElementById('homeCats');
  if(hc){
    let extra=['合婚','起名','择日'];
    let all=[...CATS.filter(c=>c!=='免费'),...extra];
    hc.innerHTML=all.map(c=>{
      let ic=CAT_ICON[c]||'📚';
      return `<div class="home-cat-item" onclick="setCat('${c}')"><div class="ic">${ic}</div><div class="lb">${c}</div></div>`;
    }).join('');
  }
}

function setCat(c){if(!COURSE_ONLINE){currentCat=c;renderCats();showCourseSoon('course_soon',c);return;}currentCat=c;renderCats();loadCourses();}

// ===== 首页 Banner 轮播 =====
function renderBanner(){
  if(_banners.length===0)return;
  let b=_banners[_bIdx];
  if(b.image){
    document.getElementById('bArt').innerHTML=`<img src="${b.image}" style="width:100%;height:100%;object-fit:cover">`;
    document.getElementById('bArt').style.fontSize='';
    document.getElementById('bArt').style.opacity='1';
  }else{
    document.getElementById('bArt').textContent=b.art||'☯';
    document.getElementById('bArt').style.fontSize='120px';
    document.getElementById('bArt').style.opacity='.6';
  }
  // 多语言：Banner 标题/副标题动态内容按合并词典翻译（TIPatch EXTRA）
  function _i18nDyn(x){ try{ var A=window.__TI_ALL; if(A&&window.__TIPick2){ var v=window.__TIPick2(A.EXTRA,x)||window.__TIPick2(A.DICT,x); if(v) return v; } }catch(e){} return x; }
  document.getElementById('bTitle').textContent=_i18nDyn(b.title);
  document.getElementById('bSub').textContent=_i18nDyn(b.sub);
  document.getElementById('bDots').innerHTML=_banners.map((_,i)=>`<div class="d${i===_bIdx?' on':''}"></div>`).join('');
}
function bannerNext(){
  _bIdx=(_bIdx+1)%_banners.length;
  renderBanner();
}
function startBannerTimer(){
  if(_bTimer)clearInterval(_bTimer);
  if(_banners.length>1)_bTimer=setInterval(bannerNext,4000);
}
function bannerClick(){
  if(!COURSE_ONLINE){currentCat='';renderCats();showCourseSoon('course_soon','');try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}return;}
  let b=_banners[_bIdx];
  if(b.url){var _u=b.url;if(_u.charAt(0)==='/')_u='https://tianji.matetechhk.com'+_u;location.href=_u;return;}
  if(b.cat){setCat(b.cat);}
}

// ===== 首页 5 入口 =====
function openEntry(k){
  if(k==='courses'){setCat('');window.scrollTo({top:380,behavior:'smooth'});}
  else if(k==='checkin'){showMyPanel('checkin');}
  else if(k==='invite'){showMyPanel('invite');}
  else if(k==='contact'){alert('请联系客服微信：suanleme-help');}
  else if(k==='welfare'){alert('🎊 更多福利即将上线\n每日签到 · 学习打卡 · 邀请好友奖励\n敬请期待！');}
}

// ===== 搜索栏（前端筛选课程） =====
function showHomeSearch(){
  if(!COURSE_ONLINE){currentCat='';renderCats();showCourseSoon('course_soon','');return;}
  let kw=prompt('请输入搜索关键词');
  if(!kw)return;
  let url=API+'/api/courses';
  fetch(url).then(r=>r.json()).then(r=>{
    if(!r.ok)return alert('查询失败');
    let all=r.items||[];
    let matched=all.filter(c=>{
      return (c.title||'').includes(kw) || (c.category||'').includes(kw) || (c.desc||'').includes(kw);
    });
    if(matched.length===0)return alert('未找到相关课程');
    document.getElementById('courseList').innerHTML=`<div style="grid-column:1/-1;color:var(--sub);font-size:13px;padding:8px 0">搜索「${kw}」共 ${matched.length} 个结果</div>`+matched.map(c=>renderCourseCard(c)).join('');
    document.getElementById('cats').style.display='none';
    window.scrollTo({top:480,behavior:'smooth'});
    setTimeout(()=>{document.getElementById('cats').style.display='flex';},100);
  });
}

// ===== 渲染课程卡片（抽出供网格 + 免费课共用） =====
function renderCourseCard(c){
  let cover=c.cover?`<img src="${c.cover}" style="width:100%;height:100%;object-fit:cover">`:(CAT_ICON[c.category]||'🎓');
  let priceTag=c.is_free?'<span class="ftag">免费</span>':(c.owned?'<span class="otag">已购</span>':`<span class="price">${c.points_cost>0?c.points_cost+'易币':'¥'+c.price}</span>`);
  return `<div class="home-card" onclick="openDetail(${c.id})">
    <div class="cover">${cover}</div>
    <div class="title">${c.title}</div>
    <div class="meta"><span>${c.type==='video'?'▶视频':c.type==='audio'?'🎧音频':'📄图文'}</span>${priceTag}</div>
  </div>`;
}

// ===== 加载免费课程（横滑卡片） =====
async function loadFreeList(){
  if(!COURSE_ONLINE){var _fs=document.getElementById('homeFreeSection');if(_fs)_fs.style.display='none';return;}
  let r=await fetch(API+'/api/courses').then(r=>r.json());
  if(!r.ok)return;
  let free=(r.items||[]).filter(c=>c.is_free).slice(0,12);
  document.getElementById('homeFreeList').innerHTML=free.map(c=>{
    let cover=c.cover?`<img src="${c.cover}" style="width:100%;height:100%;object-fit:cover">`:(CAT_ICON[c.category]||'🎓');
    return `<div class="home-free-card" onclick="openDetail(${c.id})">
      <div class="cov">${cover}</div>
      <div class="t">${c.title}</div>
    </div>`;
  }).join('')||'<div style="color:var(--sub);font-size:13px;padding:8px 0">暂无免费课程</div>';
}

// ===== FAB 浮动按钮 =====
function homeFab(){
  if(!TOKEN){showAuth();return;}
  showMyPanel('checkin');
}

function showList(){
  if(!COURSE_ONLINE){
    var _cl=document.getElementById('courseList'); if(_cl)_cl.style.display='none';
    document.getElementById('detailPage').style.display='none';
    document.getElementById('playerPage').style.display='none';
    document.getElementById('buyBar').style.display='none';
    showCourseSoon('course_soon',currentCat);
    return;
  }
  document.getElementById('courseList').style.display='grid';
  document.getElementById('detailPage').style.display='none';
  document.getElementById('playerPage').style.display='none';
  document.getElementById('buyBar').style.display='none';
}

function backToList(){showList();}

async function loadCourses(){
  if(!COURSE_ONLINE){showCourseSoon('course_soon',currentCat);return;}
  let url=API+'/api/courses';
  if(currentCat)url+='?cat='+encodeURIComponent(currentCat);
  let r=await fetch(url).then(r=>r.json());
  if(!r.ok)return;
  let items=r.items||[];
  if(items.length===0){
    document.getElementById('courseList').innerHTML='<p style="grid-column:1/-1;text-align:center;color:var(--sub);padding:40px">暂无课程</p>';
    return;
  }
  document.getElementById('courseList').innerHTML=items.map(c=>renderCourseCard(c)).join('');
}

async function openDetail(cid){
  if(!COURSE_ONLINE){courseNotOpen();return;}
  let r=await fetch(API+'/api/course/'+cid,{headers:h()}).then(r=>r.json());
  if(!r.ok)return alert(r.msg);
  currentCourse=r.item;
  document.getElementById('courseList').style.display='none';
  document.getElementById('detailPage').style.display='block';
  document.getElementById('playerPage').style.display='none';
  document.getElementById('dCover').innerHTML=currentCourse.cover?`<img src="${currentCourse.cover}">`:CAT_ICON[currentCourse.category]||'🎓';
  document.getElementById('dTitle').textContent=currentCourse.title;
  document.getElementById('dCat').textContent=currentCourse.category;
  document.getElementById('dType').textContent=TYPE_NAME[currentCourse.type]||currentCourse.type;
  document.getElementById('dDesc').textContent=currentCourse.desc||'暂无简介';
  let favBtn=document.getElementById('favBtn');
  favBtn.textContent=currentCourse.fav?'★':'☆';
  favBtn.style.color=currentCourse.fav?'var(--gold)':'var(--text)';
  let bar=document.getElementById('buyBar');
  if(currentCourse.owned){
    document.getElementById('buyPrice').textContent='已拥有';
    document.getElementById('buyBtn').textContent='开始学习';
  }else if(currentCourse.is_free){
    document.getElementById('buyPrice').textContent='免费';
    document.getElementById('buyBtn').textContent='立即学习';
  }else{
    let orig=currentCourse.points_cost;
    let cost=currentCourse.discounted_cost!==undefined?currentCourse.discounted_cost:orig;
    let disc=currentCourse.discount!==undefined?currentCourse.discount:100;
    if(disc<100){
      document.getElementById('buyPrice').innerHTML=`<span style="text-decoration:line-through;color:var(--sub);font-size:14px">${orig}易币</span> <span>${cost}易币</span> <span style="font-size:12px;color:var(--gold)">(${disc/10}折)</span>`;
    }else{
      document.getElementById('buyPrice').textContent=orig>0?orig+' 易币':'¥'+currentCourse.price;
    }
    document.getElementById('buyBtn').textContent='购买学习';
  }
  bar.style.display='flex';
}

function backToDetail(){
  if(!currentCourse)return backToList();
  document.getElementById('playerPage').style.display='none';
  document.getElementById('detailPage').style.display='block';
  document.getElementById('buyBar').style.display='flex';
}

async function buyCourse(){
  if(!COURSE_ONLINE){courseNotOpen();return;}
  if(!TOKEN){showAuth();return;}
  if(currentCourse.owned){startLearn();return;}
  if(currentCourse.is_free){doBuy('free');return;}
  // 弹出支付方式选择
  openPay();
}
function openPay(){
  let c=currentCourse;
  let need=Number(c.yibi_cost||c.discounted_cost||c.points_cost||0);
  document.getElementById('payTitle').textContent=c.title;
  let opts=[];
  if(need>0){
    opts.push(`<label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--c2);border-radius:8px;cursor:pointer"><input type="radio" name="payType" value="yibi" checked onchange="onPayChange()"> <span style="flex:1">易币支付</span><span style="color:var(--gold);font-weight:700">${need} 易币</span></label>`);
  }
  document.getElementById('payOptions').innerHTML=opts.join('');
  document.getElementById('payDesc').textContent=`易币价 ${need}`;
  onPayChange();
  document.getElementById('payModal').classList.add('show');
}
function closePay(){document.getElementById('payModal').classList.remove('show');}
function onPayChange(){
  document.getElementById('mixBox').style.display='none';
}
function onMixChange(){}
async function confirmPay(){
  await doBuy('yibi');
}
async function doBuy(pay_type){
  if(!COURSE_ONLINE){courseNotOpen();return;}
  let body={pay_type:'yibi'};
  let r=await fetch(API+'/api/course/'+currentCourse.id+'/buy',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
  if(!r.ok){alert(r.msg);return;}
  closePay();
  alert(r.msg||'完成');
  currentCourse.owned=true;
  startLearn();
}

function startLearn(){
  if(!COURSE_ONLINE){courseNotOpen();return;}
  if(!currentCourse)return;
  document.getElementById('detailPage').style.display='none';
  document.getElementById('buyBar').style.display='none';
  document.getElementById('playerPage').style.display='block';
  document.getElementById('pVideoBox').style.display='none';
  document.getElementById('pAudioBox').style.display='none';
  document.getElementById('pArticle').style.display='none';
  if(currentCourse.type==='video'&&currentCourse.video_url){
    document.getElementById('pVideoBox').style.display='block';
    let v=document.getElementById('pVideo');
    v.src=currentCourse.video_url;
    v.currentTime=currentCourse.last_pos||0;
    v.onloadedmetadata=()=>{if(currentCourse.last_pos)v.currentTime=currentCourse.last_pos;};
    v.onended=()=>saveProgress(100,0);
    v.ontimeupdate=()=>{if(v.duration)saveProgress(Math.floor(v.currentTime/v.duration*100),Math.floor(v.currentTime));};
  }else if(currentCourse.type==='audio'&&currentCourse.audio_url){
    document.getElementById('pAudioBox').style.display='block';
    let a=document.getElementById('pAudio');
    a.src=currentCourse.audio_url;
    a.onended=()=>saveProgress(100,0);
  }else if(currentCourse.type==='article'&&currentCourse.content){
    document.getElementById('pArticle').style.display='block';
    document.getElementById('pArticle').innerHTML=currentCourse.content;
  }else{
    document.getElementById('pArticle').style.display='block';
    document.getElementById('pArticle').innerHTML='<p style="color:var(--sub);text-align:center;padding:40px">内容待上传</p>';
  }
}

let saveTimer=null;
function saveProgress(pct,pos){
  if(!COURSE_ONLINE)return;
  if(!TOKEN||!currentCourse)return;
  if(saveTimer)clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    await fetch(API+'/api/course/'+currentCourse.id+'/progress',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({progress:pct,last_pos:pos})});
  },1000);
}

function markDone(){
  if(!currentCourse)return;
  saveProgress(100,0);
  alert('✅ 已标记完成');
}

async function toggleFav(){
  if(!COURSE_ONLINE){courseNotOpen();return;}
  if(!TOKEN){showAuth();return;}
  if(!currentCourse)return;
  let r=await fetch(API+'/api/course/'+currentCourse.id+'/fav',{method:'POST',headers:h()}).then(r=>r.json());
  if(!r.ok)return alert(r.msg);
  currentCourse.fav=r.fav;
  document.getElementById('favBtn').textContent=r.fav?'★':'☆';
  document.getElementById('favBtn').style.color=r.fav?'var(--gold)':'var(--text)';
}
function showAuth(tip){
  // 兼容被当作事件处理器直接绑定（onclick=showAuth）：此时 tip 可能是 Event 对象，需忽略
  var msg=(typeof tip==='string')?tip:'';
  var t=document.getElementById('authTip');
  if(t){ if(msg){t.textContent=msg;t.style.display='block';} else {t.textContent='';t.style.display='none';} }
  // 自动回填已保存的账号/密码
  try{
    var sa=localStorage.getItem('yx_acct')||'', sp=localStorage.getItem('yx_pw')||'';
    var ac=document.getElementById('loginAccount'), pw=document.getElementById('loginPw');
    if(ac&&sa&&!ac.value)ac.value=sa;
    if(pw&&sp&&!pw.value)pw.value=decodeURIComponent(escape(atob(sp)));
    var rm=document.getElementById('loginRemember'); if(rm&&(sa&&sp))rm.checked=true;
    var kp=document.getElementById('loginKeep'); if(kp&&localStorage.getItem('yx_keep')==='1')kp.checked=true;
  }catch(e){}
  document.getElementById('authModal').classList.add('show');
  var a=document.getElementById('loginAccount'); if(a&&!a.value)setTimeout(function(){try{a.focus();}catch(e){}},120);
}
function closeAuth(){document.getElementById('authModal').classList.remove('show')}
function switchAuth(t){
  document.getElementById('authModal').classList.remove('show');
  document.getElementById('regModal').classList.add('show');
  // 自动带 URL 里的邀请码
  let ref=new URLSearchParams(location.search).get('ref')||'';
  if(ref)document.getElementById('regRef').value=ref;
}
function regCountryChange(){
  // 区号切换时无需额外操作，验证码发送时会读取
}
function closeReg(){document.getElementById('regModal').classList.remove('show')}

// ===== 2026-10-27 第6条：隐私条款确认（合规）=====
// 背景：用户注册/改个人资料时可直接提交，无任何知情同意环节，不符合个人信息保护要求。
// 做法：① 注册表单加必勾复选框；② 未勾选就点「注册」→ 不提交，高亮提示并弹隐私说明；
//      ③ 「个人资料」保存前也弹一次确认（已同意过的不重复骚扰，但首次必须过）。
var _privacyAgreed=false;   // 本次会话内是否已同意
function openPrivacy(){
  if(typeof closeReg==='function'){/* 不关注册框，弹层叠在上面 */}
  document.getElementById('privacyModal').classList.add('show');
}
function closePrivacy(){
  document.getElementById('privacyModal').classList.remove('show');
}
function agreePrivacy(){
  _privacyAgreed=true;
  var c=document.getElementById('regPrivacyChk');
  if(c)c.checked=true;
  var tip=document.getElementById('regPrivacyTip');
  if(tip)tip.style.display='none';
  closePrivacy();
}
// 未同意时阻止提交，并给出可点开的说明入口
function _requirePrivacy(){
  var c=document.getElementById('regPrivacyChk');
  if(c&&c.checked) return true;
  if(_privacyAgreed) return true;
  var tip=document.getElementById('regPrivacyTip');
  if(tip)tip.style.display='block';
  openPrivacy();
  return false;
}
// 注册方式切换
let regTab='email';
function switchRegTab(t){
  regTab=t;
  document.getElementById('regTabPhone').classList.toggle('active',t==='phone');
  document.getElementById('regTabEmail').classList.toggle('active',t==='email');
  document.getElementById('regPhonePane').style.display=(t==='phone')?'':'none';
  document.getElementById('regEmailPane').style.display=(t==='email')?'':'none';
}
// 发送验证码（phone / email）
let codeTimer=null;
function sendCode(channel){
  let target, btnId;
  if(channel==='phone'){
    let cc=document.getElementById('regCountry').value;
    let num=document.getElementById('regPhone').value.trim();
    target=cc+num;
    btnId='phoneCodeBtn';
  }else{
    target=document.getElementById('regEmail').value.trim();
    btnId='emailCodeBtn';
  }
  if(!target||target==='+'||(channel==='email'&&!target.includes('@')))return alert('请先填写'+(channel==='phone'?'手机号':'邮箱'));
  let btn=document.getElementById(btnId);
  btn.disabled=true;
  let payload={channel:channel,target:target,purpose:'register'};
  if(channel==='phone'){
    let be=document.getElementById('regBackupEmail');
    if(be&&be.value.trim())payload.backup_email=be.value.trim();
  }
  fetch(API+'/api/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json()).then(r=>{
    if(!r.ok){btn.disabled=false;return alert(r.msg);}
    alert(r.msg+(r.dev?'（演示模式：验证码见后端日志，未真实发送）':''));
    // 倒计时 60 秒
    let s=60;btn.textContent=s+'s';
    if(codeTimer)clearInterval(codeTimer);
    codeTimer=setInterval(()=>{s--;btn.textContent=s+'s';if(s<=0){clearInterval(codeTimer);btn.textContent='获取验证码';btn.disabled=false;}},1000);
  }).catch(e=>{btn.disabled=false;alert('网络错误');});
}
async function doLogin(){
  let acctRaw=document.getElementById('loginAccount').value.trim(),pw=document.getElementById('loginPw').value;
  if(!acctRaw||!pw)return alert('请输入账号和密码');
  // 去掉空格、横线等常见分隔符（iOS 自动填充常带空格或 +86）
  let acct=acctRaw.replace(/[\s\-\(\)]/g,'');
  // 去掉 00/+86/+852 前缀，保留裸手机号
  if(acct.startsWith('+')){
    if(acct.startsWith('+86') && acct.length===14) acct=acct.slice(3);
    else if(acct.startsWith('+852') && acct.length===12) acct=acct.slice(4);
  } else if(acct.startsWith('0086') && acct.length===13){
    acct=acct.slice(4);
  }
  let r=await fetch(API+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:acct,password:pw})}).then(r=>r.json());
  if(!r.ok)return alert(r.msg);
  TOKEN=r.token;USER=r.user;localStorage.setItem('yx_tk',TOKEN);
  try{let exp=new Date(Date.now()+3650*24*3600*1000).toUTCString();document.cookie='yx_tk='+TOKEN+';expires='+exp+';path=/;SameSite=Lax';}catch(e){}
  try{
    var _rm=document.getElementById('loginRemember'), _kp=document.getElementById('loginKeep');
    if(_rm&&_rm.checked){ localStorage.setItem('yx_acct',acct); localStorage.setItem('yx_pw',btoa(unescape(encodeURIComponent(pw)))); }
    else { localStorage.removeItem('yx_acct'); localStorage.removeItem('yx_pw'); }
    if(_kp&&_kp.checked){ localStorage.setItem('yx_keep','1'); } else { localStorage.removeItem('yx_keep'); }
  }catch(e){}
  closeAuth();
  // 管理员登录后隐藏维护横幅
  if(USER&&USER.role&&(USER.role==='admin'||USER.role==='superadmin')){
    let b=document.getElementById('mtBanner');if(b)b.style.display='none';
  }
  loadCourses();
  if(mainTab==='me')refreshMe();
  afterLoginBack();
  // 2026-10-31 算了吗第8项：登录/注册成功后若带「百万富翁房间」上下文，直接回房间。
  try{
    var _pr=sessionStorage.getItem('ml_pending_room');
    var _m=/[?&]room=([A-Za-z0-9]{2,12})(?:&|\b)/.exec(location.search+' '+location.hash);
    var _code=_pr||(_m?_m[1].toUpperCase():'');
    if(_code){ setTimeout(function(){ location.href='https://tianji.matetechhk.com/millionaire?room='+_code; }, 80); return; }
  }catch(e){}
}

// 登录/注册成功后：若来源页带 __login_back，返回该页继续用（所有工具需登录）
function afterLoginBack(){
  let back=(()=>{try{return sessionStorage.getItem('__login_back')||'';}catch(e){return '';}})();
  if(!back)return;
  try{sessionStorage.removeItem('__login_back');}catch(e){}
  if(!/^https?:/i.test(back))return; // file:// 内置页无有效来源，避免跳到无效地址
  if(back.indexOf('/xuetang')===0)return; // 本页即学堂，无需跳转
  location.href=back;
}
async function doRegister(){
  // 2026-10-27 第6条：未勾选隐私条款不得提交
  if(!_requirePrivacy()) return;
  let ref=document.getElementById('regRef').value.trim();
  let gender=document.getElementById('regGender').value;
  let name=document.getElementById('regName').value.trim();
  let address=document.getElementById('regAddr').value.trim();
  let body={referee:ref,gender:gender,name:name,address:address};
  if(regTab==='phone'){
    let cc=document.getElementById('regCountry').value;
    let num=document.getElementById('regPhone').value.trim();
    let code=document.getElementById('regPhoneCode').value.trim();
    let pw=document.getElementById('regPw').value, pw2=document.getElementById('regPw2').value;
    if(!num)return alert('请输入手机号');
    if(!code)return alert('请输入验证码');
    if(!pw||pw.length<6||pw.length>8)return alert('密码需为6-8位');
    if(pw!==pw2)return alert('两次输入的密码不一致');
    body.channel='phone';body.phone=num;body.country_code=cc;body.code=code;body.password=pw;body.confirm=pw2;
    let be=document.getElementById('regBackupEmail');
    if(be&&be.value.trim())body.email=be.value.trim();
  }else{
    let email=document.getElementById('regEmail').value.trim();
    let code=document.getElementById('regEmailCode').value.trim();
    let pw=document.getElementById('regPwE').value, pw2=document.getElementById('regPwE2').value;
    if(!email)return alert('请输入邮箱');
    if(!code)return alert('请输入验证码');
    if(!pw||pw.length<6||pw.length>8)return alert('密码需为6-8位');
    if(pw!==pw2)return alert('两次输入的密码不一致');
    body.channel='email';body.email=email;body.code=code;body.password=pw;body.confirm=pw2;
  }
  let r=await fetch(API+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
  if(!r.ok)return alert(r.msg);
  TOKEN=r.token;USER=r.user;localStorage.setItem('yx_tk',TOKEN);
  try{let exp=new Date(Date.now()+3650*24*3600*1000).toUTCString();document.cookie='yx_tk='+TOKEN+';expires='+exp+';path=/;SameSite=Lax';}catch(e){}
  closeReg();
  loadCourses();
  if(mainTab==='me')refreshMe();
  afterLoginBack();
  // 2026-10-31 算了吗第8项：登录/注册成功后若带「百万富翁房间」上下文，直接回房间。
  try{
    var _pr=sessionStorage.getItem('ml_pending_room');
    var _m=/[?&]room=([A-Za-z0-9]{2,12})(?:&|\b)/.exec(location.search+' '+location.hash);
    var _code=_pr||(_m?_m[1].toUpperCase():'');
    if(_code){ setTimeout(function(){ location.href='https://tianji.matetechhk.com/millionaire?room='+_code; }, 80); return; }
  }catch(e){}
}

// ===== 我的中心 =====
let mainTab='home';
function switchMainTab(t){
  mainTab=t;
  /* 2026-11-11：tab 状态同步到 URL（replaceState 不新增历史、不触发 hashchange）。
     目的：从工具页返回时 history.back() 能落回「工具」tab，而不是默认的「游戏」tab。 */
  try{
    var _h='#'+t;
    if(location.hash!==_h) history.replaceState(null,'',_h);
  }catch(e){}
  ['tabHome','tabCourse','tabTianji','tabMe'].forEach(id=>{
    var el=document.getElementById(id); if(el) el.classList.toggle('active', id==='tab'+t[0].toUpperCase()+t.slice(1));
  });
  let isMe=(t==='me');
  let isTianji=(t==='tianji');
  let isHome=(t==='home');
  let isCourse=(t==='course');
  document.getElementById('homePanel').style.display=isHome?'block':'none';
  document.getElementById('coursePanel').style.display=isCourse?'block':'none';
  document.getElementById('mePage').style.display=isMe?'block':'none';
  document.getElementById('tianjiPage').style.display=isTianji?'block':'none';
  document.getElementById('detailPage').style.display='none';
  document.getElementById('playerPage').style.display='none';
  document.getElementById('buyBar').style.display='none';
  if(t==='me'){refreshMe();window.scrollTo({top:0,behavior:'instant'});}
  if(t==='course'){ if(typeof showList==='function'){try{showList();}catch(e){}} window.scrollTo({top:0,behavior:'instant'}); }
  if(t==='home'){ window.scrollTo({top:0,behavior:'instant'}); }
}
async function loadLvCard(){
  var card=document.getElementById('lvCard');
  if(!card)return;
  if(!TOKEN){card.style.display='none';return;}
  try{
    var r=await fetch(API+'/api/lv/status',{headers:h()}).then(function(x){return x.json();});
    if(!r||!r.ok){card.style.display='none';return;}
    card.style.display='';
    document.getElementById('lvNum').textContent='Lv.'+r.level+(r.level>=r.maxLevel?' MAX':'');
    document.getElementById('lvExpTxt').textContent=
      r.level>=r.maxLevel?('已满级 · 累计 '+r.expTotal+' 经验')
        :(r.expTotal+' / '+r.nextNeed+' 经验');
    var bar=document.getElementById('lvBar'); if(bar)bar.style.width=(r.pct||0)+'%';
    var rk=document.getElementById('lvRankTxt');
    if(rk)rk.textContent=r.rankTotal>0?('经验排名 第 '+r.rank+' / '+r.rankTotal):'';
    var td=document.getElementById('lvToday'); if(td)td.textContent=r.todayExp||0;
    var pm=document.getElementById('lvPerMin'); if(pm)pm.textContent=r.expPerMin;
    var pa=document.getElementById('lvPerAct'); if(pa)pa.textContent=r.expPerAction;
  }catch(e){card.style.display='none';}
}

function _renderLoggedOut(){
  document.getElementById('meName').textContent='未登录';
  document.getElementById('meAvatar').textContent='🏯';
  document.getElementById('meVip').style.display='none';
  document.getElementById('meId').textContent='点击登录';
  document.getElementById('meExpire').textContent='';
  document.getElementById('meCheckinBtn').textContent='🔑 登录';
  document.getElementById('meCheckinBtn').onclick=showAuth;
  var _pt=document.getElementById('mePoints'); if(_pt)_pt.textContent='0';
  var _wl=document.getElementById('meWallet'); if(_wl)_wl.textContent='0';
  var _cp=document.getElementById('meCoupons'); if(_cp)_cp.textContent='0';
  var _cc=document.getElementById('meCourseCount'); if(_cc)_cc.textContent='0';
  var _ic=document.getElementById('meInviteCard'); if(_ic)_ic.style.display='none';
}
async function refreshMe(){
  if(!TOKEN){ _renderLoggedOut(); return; }
  // 关键：只有服务端「明确说凭据无效」(401/403 或 ok=false 且非网络错误) 才登出。
  // 网络抖动 / 超时 / 500 / 维护中 → 保留 token，不清登录态（原先一律清空导致「无故退出」）。
  let r=null;
  try{
    const resp=await fetch(API+'/api/me',{headers:h()});
    if(resp.status===401||resp.status===403){
      TOKEN=''; USER=null; localStorage.removeItem('yx_tk');
      try{document.cookie='yx_tk=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';}catch(e){}
      _renderLoggedOut(); return;
    }
    if(!resp.ok){ return; }              // 5xx/503 维护 → 保持登录态
    r=await resp.json();
  }catch(e){
    return;                               // 网络异常 → 保持登录态，下次再试
  }
  if(!r||!r.ok||!r.user){ return; }       // 其它异常返回 → 不清 token
  USER=r.user;
  document.getElementById('meName').textContent=USER.name||USER.phone||'会员';
  document.getElementById('meAvatar').textContent=(USER.name||'算').charAt(0);
  /* 2026-11-13 老板三层体系：0=游客 / 1=VIP(月卡年卡) / 3=黑卡($99.99工具包) */
  let vipMap={0:['游客','#9a8a6a'],1:['VIP会员','#d4af37'],2:['VIP会员','#d4af37'],3:['黑卡会员','#5a4a2a']};
  let [vn,vc]=vipMap[USER.vip]||vipMap[0];
  let vb=document.getElementById('meVip');
  vb.textContent=vn;vb.style.display='inline-block';vb.style.background=vc;
  document.getElementById('meId').textContent='ID:'+USER.id;
  document.getElementById('meExpire').textContent=USER.vip_expire?('有效期至 '+USER.vip_expire):'永久有效';
  // 2026-10-29 单一货币：此位置只显示易币。
  // 旧版页面残留的「易币」卡（mePoints）必须清空，不能填易币数值，
  // 否则同一笔余额会在两栏重复显示（截图里 52865 出现两次就是这个原因）。
  var _mp=document.getElementById('mePoints');
  if(_mp){var _mpv=_mp.closest? _mp.closest('.st') : null; if(_mpv){_mpv.style.display='none';} _mp.textContent='';}
  var _mw=document.getElementById('meWallet'); if(_mw)_mw.textContent=(USER.yibi!=null?USER.yibi:0);
  // 第7项：会员等级条
  try{ loadLvCard(); }catch(e){}
  document.getElementById('meCheckinBtn').textContent='🎁 签到';
  document.getElementById('meCheckinBtn').onclick=doMyCheckin;
  try{
    let cr=await fetch(API+'/api/my/coupons',{headers:h()}).then(r=>r.json());
    if(cr.ok)document.getElementById('meCoupons').textContent=(cr.items||[]).length;
  }catch(e){}
  try{
    let mc=await fetch(API+'/api/my/courses',{headers:h()}).then(r=>r.json());
    if(mc.ok)document.getElementById('meCourseCount').textContent=(mc.items||[]).length;
  }catch(e){}
  try{
    let ck=await fetch(API+'/api/my/checkin',{headers:h()}).then(r=>r.json());
    if(ck.ok&&ck.checked){document.getElementById('meCheckinBtn').textContent='✅ 已签到';document.getElementById('meCheckinBtn').classList.add('done');}
    else{document.getElementById('meCheckinBtn').classList.remove('done');}
  }catch(e){}
  try{
    let iv=await fetch(API+'/api/my/invite',{headers:h()}).then(r=>r.json());
    if(iv.ok){
      let codeEl=document.getElementById('meInviteCode'); if(codeEl)codeEl.textContent=iv.invite_code||'-';
      let st=document.getElementById('meInviteStats');
      if(st)st.innerHTML=`一级 ${iv.level1_count||0} 人 · 二级 ${iv.level2_count||0} 人 · 奖励累计 ${iv.total_commission||0} 易币`;
      document.getElementById('meInviteCard').style.display='block';
    }
  }catch(e){}
}
async function doMyCheckin(){
  if(!TOKEN){showAuth();return;}
  var r=null;
  try{r=await fetch(API+'/api/my/checkin',{method:'POST',headers:h()}).then(function(x){return x.json();});}
  catch(e){alert('签到失败，请检查网络后重试');return;}
  alert((r&&r.msg)||'签到失败');
  // 无论成功与否（含「今天已签到」），都立即重渲染签到面板，不能留旧的连续天数/状态
  try{
    var pm=document.getElementById('panelModal');
    if(pm&&pm.classList&&pm.classList.contains('show')){await showMyPanel('checkin');}
  }catch(e){}
  refreshMe();
}
async function logoutMe(){
  window.__confirm('确认退出登录？',function(ok){
    if(!ok)return;
    TOKEN='';USER=null;localStorage.removeItem('yx_tk');
    try{document.cookie='yx_tk=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';}catch(e){}
    refreshMe();
    loadCourses();
  });
}
async function showMyPanel(type){
  if(!TOKEN&&type!=='circle'&&type!=='invite'){showAuth();return;}
  if(!COURSE_ONLINE&&(type==='courses'||type==='favorites'||type==='orders')){
    document.getElementById('panelTitle').textContent='🎓 '+soonT('soon_prefix');
    document.getElementById('panelBody').innerHTML='<p style="color:var(--sub);text-align:center;padding:24px;line-height:1.8">'+soonT('course_soon')+'</p>';
    document.getElementById('panelModal').classList.add('show');
    return;
  }
  let title='',body='';
  if(type==='courses'){title='📖 我的课程';body=await panelCourses();}
  else if(type==='favorites'){title='⭐ 我的收藏';body=await panelFavorites();}
  else if(type==='study'){title='⏱️ 学习记录';body=await panelStudy();}
  else if(type==='orders'){title='📦 购课订单';body=await panelOrders();}
  else if(type==='points'){title='💰 我的易币';body=await panelPoints();}
  else if(type==='wallet'){title='💰 我的钱包';body=await panelWallet();}
  else if(type==='coins'){title='🪙 我的易币';body='<p style="color:var(--sub);text-align:center;padding:16px">易币：<b style="color:var(--gold)">'+(USER?(USER.yibi||0):0)+'</b></p>';}
  else if(type==='coupons'){title='🎟️ 我的优惠券';body=await panelCoupons();}
  else if(type==='circle'){title='💬 传信';body=await panelCircle();}
  else if(type==='checkin'){title='🎁 每日签到';body=await panelCheckin();}
  else if(type==='address'){title='📍 收货地址';body=await panelAddress();}
  else if(type==='invite'){title='🎫 邀请好友';body=await panelInvite();}
  else if(type==='settings'){title='👤 个人资料';body=await panelSettings();}
  else if(type==='settingsHub'){title='⚙️ 设置';body=panelSettingsHub();}
  else if(type==='checkUpdate'){title='🆕 检查更新';body=await panelCheckUpdate();}
  else if(type==='theme'){title='🎨 主题模板';body=panelTheme();}
  else if(type==='changelog'){title='📋 版本日志';body=await panelChangelog();}
  else if(type==='deleteAccount'){title='⚠️ 注销账号';body=panelDeleteAccount();}
  else if(type==='myrefunds'){title='↩️ 我的退款申请';body=await panelMyRefunds();}
  else if(type==='kefu'){title='💬 在线客服';body=panelKefu();}
  else if(type==='exchange'){title='🏦 找换店';body=await panelExchange();}
  document.getElementById('panelTitle').textContent=title;
  document.getElementById('panelBody').innerHTML=body;
  document.getElementById('panelModal').classList.add('show');
}
function closePanel(){document.getElementById('panelModal').classList.remove('show');}
// ===== 注销账号（Apple Guideline 5.1.1(v)）=====
function panelDeleteAccount(){
  return `
  <div style="font-size:13px;line-height:1.9;color:var(--sub);background:var(--bg);border:1px solid var(--red);border-radius:10px;padding:12px;margin-bottom:12px">
    <b style="color:var(--red)">此操作不可恢复。</b><br>
    注销后，您的账号及全部关联数据将被<span style="color:var(--red)">永久删除</span>，包括：<br>
    · 个人资料（手机号、邮箱、地址）<br>
    · 排盘记录与全部档案（八字/紫微/奇门/风水/相术）<br>
    · 易币余额、优惠券<br>
    · 课程订单与学习记录、商城订单、邀请关系
  </div>
  <input type="password" id="delAccPw" placeholder="请输入登录密码以确认" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" onfocus="delAccScrollToBtn()">
  <input type="text" id="delAccConfirm" placeholder="请输入「注销」二字以确认" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" onfocus="delAccScrollToBtn()">
  <button class="btn" style="width:100%;background:var(--red);color:#fff;margin-top:8px" onclick="doDeleteAccount()">我已知晓，继续注销</button>
  <button class="btn outline" style="width:100%;margin-top:6px" onclick="closePanel()">取消</button>`;
}
// iOS 键盘弹出时，把「确认注销」按钮滚到视口可见
function delAccScrollToBtn(){
  setTimeout(function(){
    try{
      var panel=document.getElementById('panelBody');
      var btns=panel?panel.querySelectorAll('button'):[];
      // 找到「确认注销」按钮
      for(var i=0;i<btns.length;i++){
        if((btns[i].textContent||'').indexOf('确认注销')>=0){
          btns[i].scrollIntoView({block:'center',behavior:'smooth'});
          break;
        }
      }
    }catch(e){}
  },250);
}
async function doDeleteAccount(){
  if(!TOKEN){showAuth();return;}
  const pw=(document.getElementById('delAccPw')||{}).value||'';
  const cf=((document.getElementById('delAccConfirm')||{}).value||'').trim();
  if(!pw)return alert('请输入登录密码');
  if(cf!=='注销')return alert('请输入「注销」二字以确认');
  window.__confirm('最后确认：注销后所有数据将永久删除且无法恢复，确定继续？',async function(ok){
    if(!ok)return;
    try{
      const r=await fetch(API+'/api/my/delete-account',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({password:pw,confirm:cf})}).then(r=>r.json());
      if(!r.ok)return alert(r.msg||'注销失败');
      alert('✅ '+(r.msg||'账号已注销'));
      closePanel();
      TOKEN='';USER=null;localStorage.removeItem('yx_tk');
      try{document.cookie='yx_tk=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';}catch(e){}
      refreshMe();
    }catch(e){alert('注销失败：'+e);}
  });
}
async function panelMyRefunds(){
  try{
    const r=await fetch(API+'/api/pay/refund/mine',{headers:h()}).then(r=>r.json());
    if(!r.ok)return '<p style="color:var(--sub);text-align:center;padding:16px">加载失败</p>';
    const items=r.items||[];
    if(!items.length)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无退款申请<br><span style="font-size:12px">如需退款，请到「充值/订单」或联系客服</span></p>';
    const ST={pending:['待审核','var(--gold)'],approved:['已退款','var(--green)'],rejected:['已驳回','var(--red)'],canceled:['已取消','var(--sub)']};
    return items.map(x=>{
      const s=ST[x.status]||[x.status,'var(--sub)'];
      return `<div style="background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="color:var(--gold);font-size:13px">订单 ${x.out_trade_no||''}</b>
          <span style="color:${s[1]};font-size:13px">${s[0]}</span>
        </div>
        <div style="color:var(--sub);font-size:12px;margin-top:4px">申请时间：${(x.created_at||'').slice(0,16)}</div>
        ${x.reason?`<div style="font-size:13px;margin-top:4px">原因：${x.reason}</div>`:''}
        ${x.admin_note?`<div style="color:var(--sub);font-size:12px;margin-top:4px">客服备注：${x.admin_note}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){return '<p style="color:var(--sub)">加载失败</p>';}
}
// ===== 2026-10-29：设置聚合页（原「我的学习/更多功能/设置」三块全部收进来）=====
function panelSettingsHub(){
  function li(ic, txt, act){
    return '<div class="li" style="display:flex;align-items:center;gap:12px;padding:14px 4px;border-bottom:1px solid var(--c2);cursor:pointer" onclick="'+act+'">'
      +'<span style="font-size:20px;display:flex;align-items:center;justify-content:center;width:26px;height:29px;flex:0 0 26px">'+ic+'</span>'
      +'<span style="flex:1;font-size:14.5px">'+txt+'</span>'
      +'<span style="color:var(--sub)">›</span></div>';
  }
  function grp(title, rows){
    return '<div style="margin-bottom:14px">'
      +'<div style="font-size:12.5px;color:var(--gold);font-weight:700;padding:2px 0 4px">'+title+'</div>'
      +'<div style="background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:0 12px">'
      +rows.join('').replace(/border-bottom:1px solid var\(--c2\);(?=.*$)/,'')
      +'</div></div>';
  }
  var learning = [
    li('📖','我的课程',"closePanel();showMyPanel('courses')"),
    li('⭐','我的收藏',"closePanel();showMyPanel('favorites')"),
    li('⏱️','学习记录',"closePanel();showMyPanel('study')"),
    li('📦','购课订单',"closePanel();showMyPanel('orders')")
  ];
  var more = [
    li('<img src="tool-icons/chuanyin-icon.png" style="width:26px;height:26px;border-radius:22%;display:block" alt="">','传信',"location.href='https://tianji.matetechhk.com/circle'"),
    li('🎁','每日签到',"closePanel();showMyPanel('checkin')"),
    li('🏆','排行榜',"location.href='https://tianji.matetechhk.com/rank'"),
    li('🎁','奖励中心',"location.href='https://tianji.matetechhk.com/rewards'"),
    li('📍','收货地址',"closePanel();showMyPanel('address')"),
    li('🎫','邀请好友',"closePanel();showMyPanel('invite')")
  ];
  var setting = [
    li('👤','个人资料',"closePanel();showMyPanel('settings')"),
    li('🎨','主题模板（会员专属）',"closePanel();showMyPanel('theme')"),
    li('🆕','检查更新',"closePanel();showMyPanel('checkUpdate')"),
    li('📋','版本日志',"closePanel();showMyPanel('changelog')"),
    li('💬','在线客服',"closePanel();showMyPanel('kefu')"),
    li('📞','联系我们',"location.href='https://tianji.matetechhk.com/contact'"),
    li('💰','充值',"location.href='../vip.html'"),
    li('🚪','退出登录','logoutMe()'),
    li('⚠️','<span style="color:var(--red)">注销账号</span>',"closePanel();showMyPanel('deleteAccount')")
  ];
  return '<div style="padding-bottom:6px">'
    + grp('📚 我的学习', learning)
    + grp('🛠️ 更多功能', more)
    + grp('⚙️ 偏好与账号', setting)
    +'</div>';
}

// ===== 检查更新 =====
function _appVerFromUA(){
  var ua = navigator.userAgent || '';
  var m = ua.match(/SuanLeMeApp\/([\d.]+)(?:\s*\(Android;\s*code\s*(\d+)\))?/);
  return { name: m ? m[1] : '', code: (m && m[2]) ? parseInt(m[2], 10) : 0, inApp: ua.indexOf('SuanLeMeApp/') >= 0 };
}
async function panelCheckUpdate(){
  var cur = _appVerFromUA();
  var r = null;
  try{
    r = await fetch('/api/app/version?t=' + Date.now(), {cache:'no-store'}).then(function(x){return x.json()});
  }catch(e){ r = null; }
  if(!r || !r.versionCode){
    return '<p style="color:var(--sub);text-align:center;padding:22px">检查失败，请稍后重试</p>'
      + '<button class="btn outline" style="width:100%" onclick="closePanel();showMyPanel(\'checkUpdate\')">重新检查</button>';
  }
  var latestCode = r.versionCode || 0, latestName = r.versionName || r.version || '';
  var hasNew = !cur.code ? true : (latestCode > cur.code);
  var curTxt = cur.inApp ? (cur.name ? ('v' + cur.name) : '未知版本') : '网页版（浏览器打开）';

  var h = '<div style="text-align:center;padding:6px 0 14px">'
    + '<div style="font-size:44px;line-height:1.2">' + (hasNew ? '🆕' : '✅') + '</div>'
    + '<div style="font-size:16px;color:var(--gold);font-weight:700;margin-top:6px">'
    + (hasNew ? ('发现新版本 v' + latestName) : '已是最新版本') + '</div>'
    + '<div style="font-size:12.5px;color:var(--sub);margin-top:6px">'
    + '当前：' + curTxt + ' ｜ 最新：v' + latestName + '（' + latestCode + '）</div>'
    + '</div>';

  if(!hasNew){
    h += '<div style="font-size:12.5px;color:var(--sub);line-height:1.8;background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:10px 12px">'
      + '你已经在用最新版本，无需更新。<br>网页内容会自动更新，重新打开即生效。</div>';
    return h;
  }

  if(r.notes){
    var lines = String(r.notes).split('\n').filter(function(l){return l.trim()}).map(function(l){
      return '<div style="font-size:13px;line-height:1.75">· ' + l.replace(/^\d+\.\s*/, '') + '</div>';
    }).join('');
    h += '<div style="background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:10px 12px;max-height:190px;overflow-y:auto;margin-bottom:12px">'
      + '<div style="font-size:12.5px;color:var(--gold);font-weight:700;margin-bottom:4px">更新内容</div>' + lines + '</div>';
  }

  h += '<button class="btn" style="width:100%" onclick="doAppUpdate(\'' + (r.url || '') + '\')">立即更新</button>';
  h += '<button class="btn outline" style="width:100%;margin-top:8px" onclick="closePanel();showMyPanel(\'changelog\')">查看历史版本日志</button>';
  return h;
}
function doAppUpdate(url){
  if(!url){ alert('下载地址缺失，请稍后重试'); return; }
  var cur = _appVerFromUA();
  if(!cur.inApp){
    // 浏览器里：直接给下载链接
    window.location.href = url;
    return;
  }
  // App 内：WebView 的 DownloadListener 会接手
  window.location.href = url;
}

async function panelChangelog(){
  try{
    const r=await fetch('/api/changelog').then(r=>r.json());
    if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
    const items=r.items||[];
    if(!items.length)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无版本日志</p>';
    return items.map(c=>{
      const lines=(c.content||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="font-size:13px;color:var(--text);line-height:1.7;margin-top:2px">· ${l}</div>`).join('');
      return `<div style="background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <b style="color:var(--gold);font-size:15px">${c.version}</b>
          <span style="color:var(--sub);font-size:11px">${c.created_at||''}</span>
        </div>
        ${c.title&&c.title!==c.version?`<div style="font-size:13px;color:var(--text);margin-bottom:4px">${c.title}</div>`:''}
        ${lines}
      </div>`;
    }).join('');
  }catch(e){return '<p style="color:var(--sub)">加载失败</p>';}
}
async function panelCourses(){
  let r=await fetch(API+'/api/my/courses',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
  let items=r.items||[];
  if(items.length===0)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无已购课程</p>';
  return items.map(c=>`<div class="mycourse-item" onclick="closePanel();openDetail(${c.id})">
    <div class="cov">${c.cover?`<img src="${c.cover}">`:'🎓'}</div>
    <div class="in"><div class="tt">${c.title}</div>
      <div class="prog"><div class="bar" style="width:${c.progress||0}%"></div></div>
      <div class="pct">已学 ${c.progress||0}%</div></div>
  </div>`).join('');
}
async function panelFavorites(){
  let r=await fetch(API+'/api/my/favorites',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
  let items=r.items||[];
  if(items.length===0)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无收藏</p>';
  return items.map(c=>`<div class="mycourse-item" onclick="closePanel();openDetail(${c.id})">
    <div class="cov">${c.cover?`<img src="${c.cover}">`:'🎓'}</div>
    <div class="in"><div class="tt">${c.title}</div><div class="pct">${c.category} · ${c.type==='video'?'视频':c.type==='audio'?'音频':'图文'}</div></div>
  </div>`).join('');
}
async function panelStudy(){
  let r=await fetch(API+'/api/my/study-log',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
  let h=r.total_seconds||0;
  let hh=Math.floor(h/3600),mm=Math.floor(h%3600/60);
  let html=`<div style="text-align:center;padding:16px"><div style="font-size:32px;color:var(--gold);font-weight:700">${hh}小时${mm}分</div><div style="color:var(--sub);font-size:12px">累计学习时长</div></div>`;
  let items=r.items||[];
  if(items.length===0)return html+'<p style="color:var(--sub);text-align:center;padding:16px">暂无学习记录</p>';
  html+='<div style="max-height:300px;overflow-y:auto">';
  html+=items.map(l=>`<div class="li" style="cursor:default;padding:10px 16px"><span class="ic">🎓</span><span class="txt">${l.course_title||'课程'}</span><span style="color:var(--sub);font-size:12px">${Math.floor((l.seconds||0)/60)}分钟 · ${(l.created_at||'').slice(0,16)}</span></div>`).join('');
  html+='</div>';
  return html;
}
async function panelOrders(){
  let r=await fetch(API+'/api/my/courses',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
  let items=r.items||[];
  if(items.length===0)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无购课记录</p>';
  return items.map(c=>`<div class="li" style="cursor:default;padding:12px 16px"><span class="ic">📦</span><span class="txt">${c.title}</span><span style="color:var(--sub);font-size:12px">${(c.bought_at||'').slice(0,16)}</span></div>`).join('');
}
async function panelPoints(){
  let r=await fetch(API+'/api/yibi/log',{headers:h()}).then(r=>r.json());
  let html=`<div style="text-align:center;padding:16px"><div style="font-size:32px;color:var(--gold);font-weight:700">${USER?(USER.yibi||0):0}</div><div style="color:var(--sub);font-size:12px">当前易币</div></div>`;
  if(r.ok&&r.items&&r.items.length){
    html+=r.items.map(l=>`<div class="li" style="cursor:default;padding:10px 16px"><span class="ic">${l.amount>0?'➕':'➖'}</span><span class="txt">${l.reason}</span><span style="color:${l.amount>0?'var(--green)':'var(--red)'};font-size:13px">${l.amount>0?'+':''}${l.amount}</span></div>`).join('');
  }
  return html;
}
// ===== 在线客服（云 OpenClaw「算了吗小助手」）=====
function panelKefu(){
  _kefuHistory=[];
  setTimeout(_kefuWelcome,60);
  return `
  <div id="kefuBox" style="height:46vh;min-height:300px;max-height:520px;overflow-y:auto;background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:10px;font-size:13px;line-height:1.6"></div>
  <div style="display:flex;gap:8px;margin-top:10px;align-items:flex-end">
    <textarea id="kefuInput" placeholder="输入你的问题…（可回车发送 / Shift+回车换行）" maxlength="800" rows="3" style="flex:1;margin:0;resize:none;line-height:1.5;min-height:64px" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();kefuSend();}"></textarea>
    <button class="btn" style="width:auto;margin:0;padding:0 16px;height:44px;background:var(--gold);color:var(--bg)" onclick="kefuSend()">发送</button>
  </div>
  <div style="color:var(--sub);font-size:11px;margin-top:8px;text-align:center">💡 由 AI 小助手自动解答</div>`;
}
let _kefuHistory=[],_kefuBusy=false;
function _kefuWelcome(){
  var b=document.getElementById('kefuBox'); if(!b)return;
  b.innerHTML='<div style="display:flex;margin-bottom:10px"><div style="max-width:82%;background:var(--c2);border-radius:10px 10px 10px 2px;padding:8px 11px">你好呀～我是<b>算了吗小助手</b> 🧑‍💼 各种问题都可以来问我～</div></div>';
  setTimeout(function(){var i=document.getElementById('kefuInput');if(i)i.focus();},80);
}
function _kefuBubble(role,text){
  var b=document.getElementById('kefuBox'); if(!b)return;
  var mine=(role==='user');
  var d=document.createElement('div');
  d.style.cssText='display:flex;margin-bottom:10px;justify-content:'+(mine?'flex-end':'flex-start');
  var txt=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
  var bg=mine?'var(--gold)':(text&&text.indexOf('【转人工】')===0?'rgba(212,175,55,.15)':'var(--c2)');
  var fg=mine?'var(--bg)':'var(--fg)';
  d.innerHTML='<div style="max-width:82%;background:'+bg+';color:'+fg+';border-radius:10px;padding:8px 11px;word-break:break-word">'+txt+'</div>';
  b.appendChild(d);
  b.scrollTop=b.scrollHeight;
  return d;
}
async function kefuSend(){
  if(_kefuBusy)return;
  var i=document.getElementById('kefuInput'); if(!i)return;
  var q=i.value.trim(); if(!q)return;
  i.value='';
  _kefuBubble('user',q);
  _kefuHistory.push({role:'user',content:q});
  _kefuBusy=true;
  var tip=_kefuBubble('assistant','正在输入…');
  try{
    var r=await fetch(API+'/api/kefu/chat',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({message:q,history:_kefuHistory.slice(-8,-1)})}).then(r=>r.json());
    if(tip&&tip.parentNode)tip.parentNode.removeChild(tip);
    if(r.ok){
      _kefuBubble('assistant',r.reply);
      _kefuHistory.push({role:'assistant',content:r.reply});
    }else if(r.need_login){
      _kefuBubble('assistant','请先登录后再使用在线客服哦～');
    }else{
      _kefuBubble('assistant',(r.msg||'客服开小差了')+'（稍后再试或联系人工）');
    }
  }catch(e){
    if(tip&&tip.parentNode)tip.parentNode.removeChild(tip);
    _kefuBubble('assistant','网络异常，请稍后再试（人工：vcho6688@qq.com / 微信 claw4499）');
  }
  _kefuBusy=false;
}
function _walletRows(items,unit){
  if(!items||!items.length)return '<p style="color:var(--sub);text-align:center;padding:16px">暂无明细</p>';
  return items.map(l=>`<div class="li" style="cursor:default;padding:10px 16px"><span class="ic">${l.amount>0?'➕':'➖'}</span><span class="txt">${l.reason||''}<div style="color:var(--sub);font-size:11px;margin-top:2px">${(l.created_at||'').slice(0,16)}</div></span><span style="color:${l.amount>0?'var(--green)':'var(--red)'};font-size:13px;white-space:nowrap">${l.amount>0?'+':''}${l.amount} ${unit}</span></div>`).join('');
}
// 计算某类明细的收入/支出合计
function _walletSum(items){
  let inc=0,exp=0;
  (items||[]).forEach(l=>{let a=Number(l.amount||0); if(a>0)inc+=a; else exp+=Math.abs(a);});
  return {inc:inc,exp:exp};
}
// 单一货币开关（与 yibi.js 的 SINGLE 保持一致）
function _SINGLE_WALLET(){ return true; }

async function panelWallet(){
  let r=await fetch(API+'/api/my/wallet',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub);text-align:center;padding:20px">'+(r.msg||'加载失败')+'</p>';
  let yb=r.yibi||0;
  let ps=_walletSum(r.points_log), cs=_walletSum(r.coins_log);
  // ===== 2026-10-29 算了吗：单一货币（易币） =====
  if(_SINGLE_WALLET()){
    let yb=r.yibi||0, ys=_walletSum(r.yibi_log||[]);
    let h='<div style="text-align:center;margin-bottom:12px">'
      +'<div style="font-size:40px;line-height:1">👛</div>'
      +'<div style="color:var(--sub);font-size:12px;margin-top:4px">我的钱包 · 易币</div></div>'
      +'<div style="background:var(--bg);border:1px solid var(--gold);border-radius:12px;padding:16px;text-align:center;margin-bottom:12px">'
      +'<div style="font-size:12px;color:var(--sub);margin-bottom:6px">🪙 易币余额</div>'
      +'<div style="font-size:32px;color:var(--gold);font-weight:700">'+yb+'</div>'
      +'<div style="font-size:11px;color:var(--sub);margin-top:8px">收入 +'+ys.inc+' · 支出 -'+ys.exp+'</div></div>'
      +'<div style="max-height:380px;overflow-y:auto">'+_walletRows(r.yibi_log||[],'易币')+'</div>';
    return h;
  }
  let html=`<div style="text-align:center;margin-bottom:12px">
    <div style="font-size:40px;line-height:1">👛</div>
    <div style="color:var(--sub);font-size:12px;margin-top:4px">我的钱包 · 易币</div>
  </div>`;
  // 余额卡片
  html+=`<div style="background:var(--bg);border:1px solid var(--gold);border-radius:12px;padding:16px;text-align:center;margin-bottom:12px">
    <div style="font-size:12px;color:var(--sub);margin-bottom:6px">🪙 易币余额</div>
    <div style="font-size:32px;color:var(--gold);font-weight:700">${(r.yibi||0)}</div>
  </div>`;
  // 奖励累计
  let cm=r.commission||{};
  let curName='易币';
  let l1=cm.level1||0,l2=cm.level2||0;
  if(curName.indexOf('易币')>=0 && curName.indexOf('易币')<0){l1=cm.level1_coins||0;l2=cm.level2_coins||0;}
  html+=`<div style="background:var(--bg);border:1px solid var(--c2);border-radius:10px;padding:10px 12px;margin-bottom:12px;text-align:center;font-size:13px">
    <span style="color:var(--gold);font-weight:700">🎁 奖励累计</span>
    <span style="color:var(--sub);margin-left:8px">一级 ${l1} · 二级 ${l2}（奖励货币：${curName}）</span>
    <div style="color:var(--sub);font-size:11px;margin-top:4px">邀请好友注册 / 好友购课产生的奖励会进入钱包余额</div>
  </div>`;
  // 明细 tabs
  html+=`<div class="seg" style="margin:0 0 8px">
    <button id="walTabPts" class="active">💰 易币明细</button>
  </div>`;
  html+=`<div id="walBodyPts" style="max-height:340px;overflow-y:auto">${_walletRows(r.points_log,'易币')}</div>`;
  html+=`<div id="walBodyCns" style="max-height:340px;overflow-y:auto;display:none">${_walletRows(r.coins_log,'易币')}</div>`;
  return html;
}
function switchWalletTab(t){
  let p=document.getElementById('walBodyPts'),c=document.getElementById('walBodyCns');
  let bp=document.getElementById('walTabPts'),bc=document.getElementById('walTabCns');
  if(!p||!c)return;
  if(t==='coins'){p.style.display='none';c.style.display='block';bc.classList.add('active');bp.classList.remove('active');}
  else{p.style.display='block';c.style.display='none';bp.classList.add('active');bc.classList.remove('active');}
}

// ===== 找换店 =====
let _EX=null,_EXDir='pts2coins',_EXTrCur='points',_YBEX={yibi:0,per_point:20,ex_min:100,buy_min:1,points:0,date:''},_ybDir='sell';
function _exFeeCalc(amount,mode,pct,fixed){
  if(amount<=0)return {fee:0,net:0};
  let fee=mode==='fixed'?Math.floor(fixed):Math.floor(amount*pct/100);
  if(fee<0)fee=0;if(fee>amount)fee=amount;
  return {fee:fee,net:amount-fee};
}
async function panelExchange(){
  let r=await fetch(API+'/api/exchange/info',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub);text-align:center;padding:20px">加载失败</p>';
  _EX=r;
  let _yb=_YBEX={yibi:0,per_point:20,ex_min:100,buy_min:1,points:0,date:''};
  try{let w=await fetch(API+'/api/yibi/wallet',{headers:h()}).then(r=>r.json());if(w&&w.ok)_yb=Object.assign(_yb,w);}catch(e){}
  let s=r.settings||{};
  if(!s.enabled)return '<div style="text-align:center;padding:30px 16px"><div style="font-size:48px">🏦</div><div style="color:var(--gold);font-size:16px;margin-top:10px">找换店暂未开放</div><div style="color:var(--sub);font-size:12px;margin-top:6px">掌柜正在筹备中，敬请期待</div></div>';
  let yb=r.yibi||0;
  // 余额徽章
  let badges=`<div style="display:flex;gap:8px;margin-bottom:12px">
    <div style="flex:1;background:linear-gradient(160deg,#2a2318,#1c1710);border:1px solid var(--gold);border-radius:12px;padding:10px 8px;text-align:center">
      <div style="font-size:11px;color:var(--sub)">💠 易币</div>
      <div style="font-size:20px;color:var(--gold);font-weight:800">${pts}</div>
    </div>
    <div style="flex:1;background:linear-gradient(160deg,#1d2b3a,#141d28);border:1px solid #7ea6d8;border-radius:12px;padding:10px 8px;text-align:center">
      <div style="font-size:11px;color:#9dbbdd">🪙 易币</div>
      <div style="font-size:20px;color:#7ea6d8;font-weight:800">${_yb.yibi||0}</div>
    </div>
    <div style="flex:1;background:linear-gradient(160deg,#2a2318,#1c1710);border:1px solid #c9a94e;border-radius:12px;padding:10px 8px;text-align:center">
      <div style="font-size:11px;color:var(--sub)">🪙 易币</div>
      <div style="font-size:20px;color:#c9a94e;font-weight:800">${cns}</div>
    </div>
  </div>`;
  // 顶部 Tab 切换（分区，避免长滚动）
  let tabs=`<div class="ex-tabs">
    <button class="ex-tab active" data-t="yb" onclick="exTab('yb')">🪙 易币↔易币</button>
    <button class="ex-tab" data-t="pc" onclick="exTab('pc')">💱 易币↔易币</button>
    <button class="ex-tab" data-t="tf" onclick="exTab('tf')">🎁 转赠</button>
    <button class="ex-tab" data-t="cd" onclick="exTab('cd')">🎴 兑换牌</button>
  </div>`;

  // —— 分区①：易币 ↔ 易币（双向 + 今日牌价）
  let paneYb=`<div class="ex-pane active" data-p="yb">
    <div style="background:linear-gradient(135deg,#243b52,#2f5a78);border:1px solid #7ea6d8;border-radius:12px;padding:12px;margin-bottom:12px;text-align:center">
      <div style="font-size:11px;color:#bcd4ee;letter-spacing:1px">今日牌價 · ${_yb.date||''}</div>
      <div style="font-size:23px;font-weight:900;color:#eaf3ff;margin-top:3px">🪙 ${_yb.per_point} 易幣 ＝ 💠 1 易幣</div>
      <div style="font-size:11px;color:#bcd4ee;margin-top:4px">雙向同價 · 遊戲產出一律為易幣</div>
    </div>
    <div class="seg" style="margin:0 0 10px">
      <button id="ybDirSell" class="${_ybDir==='sell'?'active':''}" onclick="ybSetDir('sell')">易幣 → 易幣</button>
      <button id="ybDirBuy" class="${_ybDir==='buy'?'active':''}" onclick="ybSetDir('buy')">易幣 → 易幣</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input type="number" id="ybAmount" placeholder="兑换数量" style="flex:1" oninput="ybUpdatePreview()">
      <span id="ybUnit" style="color:var(--sub);font-size:13px;width:46px">${_ybDir==='buy'?'易币':'易币'}</span>
    </div>
    <div class="ex-quick" style="margin-bottom:8px">
      <button onclick="ybQuick(${_yb.per_point})">1 易幣</button>
      <button onclick="ybQuick(${_yb.per_point*10})">10 易幣</button>
      <button onclick="ybQuick(${_yb.per_point*50})">50 易幣</button>
    </div>
    <div id="ybPreview" class="ex-box">输入数量后显示到账</div>
    <button class="btn" style="background:#7ea6d8;color:#10202e" onclick="doYibiExchange()">立即兑换</button>
  </div>`;

  // —— 分区②：易币 ↔ 易币
  let feeDesc=s.fee_mode==='pct'?`${s.fee_pct}%`:s.fee_fixed+'（固定）';
  let panePc=`<div class="ex-pane" data-p="pc">
    <div class="ex-box" style="line-height:1.7">汇率：1 易币 ≈ <b style="color:var(--gold)">${s.coins_to_pts_rate}</b> 易币 · 单笔最低 ${s.min_amount} 易币等值 · 手续费 ${feeDesc}</div>
    <div class="seg" style="margin:0 0 10px">
      <button id="exDirP2C" class="${_EXDir==='pts2coins'?'active':''}" onclick="exSetDir('pts2coins')">易币 → 易币</button>
      <button id="exDirC2P" class="${_EXDir==='coins2pts'?'active':''}" onclick="exSetDir('coins2pts')">易币 → 易币</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input type="number" id="exAmount" placeholder="兑换数量" style="flex:1" oninput="exUpdatePreview()">
      <span id="exAmountUnit" style="color:var(--sub);font-size:13px;width:46px">易币</span>
    </div>
    <div id="exPreview" class="ex-box">输入数量后显示手续费与到账</div>
    <button class="btn" style="background:var(--gold);color:var(--bg)" onclick="doExchange()">立即兑换</button>
  </div>`;

  // —— 分区③：转赠
  let paneTf='<div class="ex-pane" data-p="tf"><div class="ex-box">找换店暂未支持转赠</div></div>';
  if(s.transfer_enabled){
    let tfeeDesc=s.transfer_fee_mode==='pct'?`${s.transfer_fee_pct}%`:s.transfer_fee_fixed+'（固定）';
    paneTf=`<div class="ex-pane" data-p="tf">
      <div class="ex-box" style="line-height:1.7">手续费 ${tfeeDesc} · 今日剩余可转赠 <b style="color:#c9a94e">${(r.transfer_remaining<0)?'不限':r.transfer_remaining}</b> 易币等值</div>
      <div class="seg" style="margin:0 0 10px">
        <button id="exTrPts" class="${_EXTrCur==='points'?'active':''}" onclick="exSetTrCur('points')">转赠易币</button>
        <button id="exTrCns" class="${_EXTrCur==='coins'?'active':''}" onclick="exSetTrCur('coins')">转赠易币</button>
      </div>
      <input type="text" id="exToUser" placeholder="收款人手机号 / 邀请码 / 会员号" style="margin:0 0 8px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input type="number" id="exTrAmount" placeholder="转赠数量" style="flex:1" oninput="exUpdateTrPreview()">
        <span id="exTrUnit" style="color:var(--sub);font-size:13px;width:46px">易币</span>
      </div>
      <div id="exTrPreview" class="ex-box">填写收款人与数量后显示手续费</div>
      <button class="btn" style="background:var(--gold);color:var(--bg)" onclick="doTransfer()">立即转赠</button>
    </div>`;
  }

  // —— 分区④：兑换牌
  let paneCd='<div class="ex-pane" data-p="cd"><div class="ex-box">暂无可购兑换牌</div></div>';
  let cards=r.cards||[];
  if(cards.length){
    let rows=cards.map(c=>{
      let pay=[];
      if(c.price_points>0)pay.push(`<button class="btn" style="background:var(--gold);color:var(--bg);width:auto;padding:6px 12px;font-size:12px" onclick="doBuyCard(${c.id},'points')">${c.price_points}易币购</button>`);
      if(c.price_coins>0)pay.push(`<button class="btn" style="background:#c9a94e;color:var(--bg);width:auto;padding:6px 12px;font-size:12px" onclick="doBuyCard(${c.id},'coins')">${c.price_coins}易币购</button>`);
      let stock=c.stock<0?'不限量':(c.stock>0?'剩 '+c.stock+' 张':(c.stock===0?'已售罄':''));
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--c2)">
        <div><div style="color:var(--text);font-size:14px">🎴 ${c.name}</div>
          <div style="color:var(--sub);font-size:11px;margin-top:2px">面额 ${c.face_value} ${c.currency==='coins'?'易币':'易币'} · ${stock}${c.descr?' · '+c.descr:''}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${pay.join('')||'<span style="color:var(--sub);font-size:12px">暂不可购</span>'}</div>
      </div>`;
    }).join('');
    paneCd=`<div class="ex-pane" data-p="cd">${rows}</div>`;
  }

  return badges+tabs+paneYb+panePc+paneTf+paneCd;
}
function exTab(t){
  document.querySelectorAll('.ex-tab').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-t')===t);});
  document.querySelectorAll('.ex-pane').forEach(function(p){p.classList.toggle('active',p.getAttribute('data-p')===t);});
}
window.exTab=exTab;
function ybQuick(n){var i=document.getElementById('ybAmount');if(i){i.value=n;ybUpdatePreview();}}
window.ybQuick=ybQuick;
function exSetDir(d){
  _EXDir=d;
  document.getElementById('exDirP2C').classList.toggle('active',d==='pts2coins');
  document.getElementById('exDirC2P').classList.toggle('active',d==='coins2pts');
  document.getElementById('exAmountUnit').textContent=d==='pts2coins'?'易币':'易币';
  exUpdatePreview();
}
function exSetTrCur(c){
  _EXTrCur=c;
  document.getElementById('exTrPts').classList.toggle('active',c==='points');
  document.getElementById('exTrCns').classList.toggle('active',c==='coins');
  document.getElementById('exTrUnit').textContent=c==='points'?'易币':'易币';
  exUpdateTrPreview();
}
function exUpdatePreview(){
  if(!_EX)return;
  let s=_EX.settings;
  let amount=parseInt(document.getElementById('exAmount').value)||0;
  let box=document.getElementById('exPreview');
  if(amount<=0){box.innerHTML='输入数量后显示手续费与到账';return;}
  let f=_exFeeCalc(amount,s.fee_mode,s.fee_pct,s.fee_fixed);
  if(_EXDir==='pts2coins'){
    let out=Math.floor(f.net/s.pts_to_coins_rate);
    box.innerHTML=`扣除 <b style="color:var(--text)">${amount}</b> 易币 · 手续费 <b style="color:var(--red)">${f.fee}</b> 易币<br>预计到账 <b style="color:var(--gold)">${out}</b> 易币（按 ${s.pts_to_coins_rate} 易币）`;
  }else{
    let out=f.net*s.coins_to_pts_rate;
    box.innerHTML=`扣除 <b style="color:var(--text)">${amount}</b> 易币 · 手续费 <b style="color:var(--red)">${f.fee}</b> 易币<br>预计到账 <b style="color:var(--gold)">${out}</b> 易币（按 ${s.coins_to_pts_rate} 易币）`;
  }
}
function exUpdateTrPreview(){
  if(!_EX)return;
  let s=_EX.settings;
  let amount=parseInt(document.getElementById('exTrAmount').value)||0;
  let box=document.getElementById('exTrPreview');
  let unit=_EXTrCur==='points'?'易币':'易币';
  if(amount<=0){box.innerHTML='填写收款人与数量后显示手续费';return;}
  let f=_exFeeCalc(amount,s.transfer_fee_mode,s.transfer_fee_pct,s.transfer_fee_fixed);
  box.innerHTML=`扣除 <b style="color:var(--text)">${amount}</b> ${unit} · 手续费 <b style="color:var(--red)">${f.fee}</b> ${unit}<br>对方到账 <b style="color:var(--gold)">${f.net}</b> ${unit}`;
}
async function doExchange(){
  let amount=parseInt(document.getElementById('exAmount').value)||0;
  if(amount<=0)return alert('请输入兑换数量');
  let r=await fetch(API+'/api/exchange/convert',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({direction:_EXDir,amount:amount})}).then(r=>r.json());
  alert(r.msg||'已提交');
  if(r.ok){if(USER){USER.points=r.points;USER.coins=r.coins;}showMyPanel('exchange');}
}
function ybSetDir(d){
  _ybDir=(d==='buy')?'buy':'sell';
  var a=document.getElementById('ybDirSell'),b=document.getElementById('ybDirBuy');
  if(a)a.classList.toggle('active',_ybDir==='sell');
  if(b)b.classList.toggle('active',_ybDir==='buy');
  var un=document.getElementById('ybUnit'); if(un)un.textContent=(_ybDir==='buy'?'易币':'易币');
  var inp=document.getElementById('ybAmount'); if(inp)inp.placeholder='兑换数量';
  ybUpdatePreview();
}
window.ybSetDir=ybSetDir;
function ybUpdatePreview(){
  let y=_YBEX||{per_point:20,ex_min:100,yibi:0,points:0};
  let amount=parseInt(document.getElementById('ybAmount').value)||0;
  let box=document.getElementById('ybPreview');
  if(amount<=0){box.innerHTML='输入数量后显示到账';return;}
  if(_ybDir==='buy'){
    // 易币 → 易币：1 易币 = per_point 易币
    if(amount<(y.buy_min||1)){box.innerHTML='<span style="color:var(--red)">单笔最少兑换 '+(y.buy_min||1)+' 易币</span>';return;}
    if(amount>(y.points||0)){box.innerHTML='<span style="color:var(--red)">易币不足，当前 '+(y.points||0)+'</span>';return;}
    let add=amount*y.per_point;
    box.innerHTML='消耗 <b style="color:var(--text)">'+amount+'</b> 易币<br>预计到账 <b style="color:#7ea6d8">'+add+'</b> 易币（1 易币='+y.per_point+' 易币）';
    return;
  }
  // 易币 → 易币
  let pts=Math.floor(amount/y.per_point);
  let used=pts*y.per_point;
  if(amount<(y.ex_min||100)){box.innerHTML='<span style="color:var(--red)">单笔最少兑换 '+(y.ex_min||100)+' 易币</span>';return;}
  if(amount>(y.yibi||0)){box.innerHTML='<span style="color:var(--red)">易币不足，当前 '+(y.yibi||0)+'</span>';return;}
  box.innerHTML='消耗 <b style="color:var(--text)">'+used+'</b> 易币<br>预计到账 <b style="color:#7ea6d8">'+pts+'</b> 易币'+(used<amount?'，余 '+(amount-used)+' 易币不参与（不足 1 易币）':'');
}
async function doYibiExchange(){
  let amount=parseInt(document.getElementById('ybAmount').value)||0;
  if(amount<=0)return alert('请输入数量');
  let label='易幣帳目';
  window.__confirm('确认进行【'+label+'】数量 '+amount+' ？',async function(ok){
    if(!ok)return;
    let path=_ybDir==='buy'?'/api/yibi/buy':'/api/yibi/exchange';
    let body=_ybDir==='buy'?{points:amount}:{amount:amount};
    let r=await fetch(API+path,{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
    alert(r.msg||'已提交');
    if(r.ok){if(USER){USER.points=r.points;USER.yibi=r.yibi;}showMyPanel('exchange');}
  });
}
async function doTransfer(){
  let target=document.getElementById('exToUser').value.trim();
  let amount=parseInt(document.getElementById('exTrAmount').value)||0;
  if(!target)return alert('请输入收款人');
  if(amount<=0)return alert('请输入转赠数量');
  window.__confirm(`确认把 ${amount} ${_EXTrCur==='points'?'易币':'易币'} 转赠给「${target}」？`,async function(ok){
    if(!ok)return;
    let r=await fetch(API+'/api/exchange/transfer',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({currency:_EXTrCur,target:target,amount:amount})}).then(r=>r.json());
    alert(r.msg||'已提交');
    if(r.ok){if(USER){USER.points=r.points;USER.coins=r.coins;}showMyPanel('exchange');}
  });
}
async function doBuyCard(cid,pay){
  let buypay=pay==='points'?'易币':'易币';
  window.__confirm(`确认用${buypay}购买该牌？`,async function(ok){
    if(!ok)return;
    let r=await fetch(API+'/api/exchange/buy-card',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({card_id:cid,pay:pay})}).then(r=>r.json());
    alert(r.msg||'已提交');
    if(r.ok){if(USER){USER.points=r.points;USER.coins=r.coins;}showMyPanel('exchange');}
  });
}
async function panelCoupons(){
  let r=await fetch(API+'/api/my/coupons',{headers:h()}).then(r=>r.json());
  if(!r.ok)return '<p style="color:var(--sub)">加载失败</p>';
  let items=r.items||[];
  if(items.length===0)return '<p style="color:var(--sub);text-align:center;padding:20px">暂无优惠券</p>';
  return items.map(cp=>`<div class="li" style="cursor:default;padding:12px 16px"><span class="ic">🎟️</span><span class="txt">${cp.title||'优惠券'}</span><span style="color:var(--sub);font-size:12px">${cp.status==='unused'?'可用':'已用'}</span></div>`).join('');
}
// ===== 签到日期：必须动态渲染 =====
// 注意：📅 (U+1F4C5) 在 Apple/Google 彩色 emoji 字体里，字形本身印死了固定的印刷日期，
// 拿它当「今天」的图标会永远显示那个固定日期，所以这里只用文本渲染 月+日。
var _CK_WD=['周日','周一','周二','周三','周四','周五','周六'];
function _ckToday(){
  try{
    var d=new Date();
    if(!d||isNaN(d.getTime()))return null;
    return {m:d.getMonth()+1,d:d.getDate(),w:d.getDay()};
  }catch(e){return null;}
}
function _ckDateText(){var t=_ckToday();return t?(t.m+'月'+t.d+'日'):'今日';}
function _ckWeekText(){var t=_ckToday();return t?(_CK_WD[t.w]||''):'';}
function _ckDateBlock(){
  return '<div data-ck-date="1" style="font-size:40px;font-weight:800;line-height:1.15;color:var(--gold);margin:8px 0 2px;letter-spacing:1px">'+_ckDateText()+'</div>'
    +'<div data-ck-week="1" style="color:var(--sub);font-size:12px;margin-bottom:6px">'+_ckWeekText()+'</div>';
}
function ckRefreshDate(){
  try{
    var a=document.querySelectorAll('[data-ck-date]');
    for(var i=0;i<a.length;i++)a[i].textContent=_ckDateText();
    var b=document.querySelectorAll('[data-ck-week]');
    for(var j=0;j<b.length;j++)b[j].textContent=_ckWeekText();
  }catch(e){}
}
function ckWatchDate(){
  if(window.__ckWatch)return;
  window.__ckWatch=1;
  var h=function(){
    try{
      if(document.visibilityState&&document.visibilityState!=='visible')return;
      ckRefreshDate();
      var day=(new Date()).toDateString();
      if(window.__ckLastDay&&window.__ckLastDay!==day){
        window.__ckLastDay=day;
        var pm=document.getElementById('panelModal');
        var pt=document.getElementById('panelTitle');
        if(pm&&pm.classList&&pm.classList.contains('show')&&pt&&(pt.textContent||'').indexOf('签到')>=0){showMyPanel('checkin');}
      }
    }catch(e){}
  };
  document.addEventListener('visibilitychange',h);
  window.addEventListener('focus',h);
}
async function panelCheckin(){
  var r=null;
  try{r=await fetch(API+'/api/my/checkin',{headers:h()}).then(function(x){return x.json();});}catch(e){r=null;}
  var ok=!!(r&&r.ok);
  var hasStreak=ok&&(r.streak!==null)&&(r.streak!==undefined)&&!isNaN(r.streak);
  var streak=hasStreak?(r.streak|0):null;
  var checked=ok&&!!r.checked;
  var streakTxt=(streak===null)?'--':(''+streak);
  try{window.__ckLastDay=(new Date()).toDateString();}catch(e){}
  try{ckWatchDate();}catch(e){}
  return '<div style="text-align:center;padding:20px" data-ck-panel="1">'
    +_ckDateBlock()
    +'<div style="font-size:20px;color:var(--gold);margin:10px 0" data-ck-streak="'+streakTxt+'">已连续签到 <b>'+streakTxt+'</b> 天</div>'
    +'<div style="color:var(--sub);font-size:12px;margin-bottom:16px">每天签到 +5 易币，连续 7 天额外 +20，连续 30 天额外 +100</div>'
    +(checked
      ? '<div data-ck-done="1" style="color:var(--gold);font-weight:700;font-size:15px;margin-bottom:8px">✅ 今日已签到</div>'
      : '<button class="btn" style="background:var(--gold);color:var(--bg)" data-ck-btn="1" onclick="doMyCheckin()">立即签到</button>')
    +'</div>';
}
async function panelAddress(){
  let r=await fetch(API+'/api/my/addresses',{headers:h()}).then(r=>r.json());
  let items=r.ok?(r.items||[]):[];
  let html='<div style="margin-bottom:10px"><input type="text" id="adName" placeholder="收货人" style="margin:4px 0"><input type="text" id="adPhone" placeholder="电话" style="margin:4px 0"><input type="text" id="adAddr" placeholder="详细地址" style="margin:4px 0"><button class="btn" style="background:var(--gold);color:var(--bg)" onclick="saveAddress()">+ 添加地址</button></div>';
  if(items.length===0)return html+'<p style="color:var(--sub);text-align:center;padding:10px">暂无地址</p>';
  html+=items.map(a=>`<div class="li" style="padding:12px 16px"><span class="ic">📍</span><span class="txt" style="flex:1">${a.name} ${a.phone}<br><span style="color:var(--sub);font-size:12px">${a.address}</span></span><button class="btn red" style="width:auto;padding:4px 10px" onclick="delAddress(${a.id})">删</button></div>`).join('');
  return html;
}
async function saveAddress(){
  let body={name:document.getElementById('adName').value.trim(),phone:document.getElementById('adPhone').value.trim(),address:document.getElementById('adAddr').value.trim()};
  if(!body.name||!body.phone||!body.address)return alert('请填写完整');
  let r=await fetch(API+'/api/my/addresses',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
  alert(r.msg||'已保存');
  showMyPanel('address');
}
async function delAddress(id){
  await fetch(API+'/api/my/addresses/'+id,{method:'DELETE',headers:h()}).then(r=>r.json());
  showMyPanel('address');
}
async function panelInvite(){
  let r=await fetch(API+'/api/my/invite',{headers:h()}).then(r=>r.json());
  let code=r.ok?r.invite_code:'';
  let link='https://tianji.matetechhk.com'+'/xuetang?ref='+code;
  let stats='';
  let team='';
  if(r.ok){
    let nextTxt=r.agent_next?`（再邀 ${(r.agent_req-r.level1_count)>0?(r.agent_req-r.level1_count):0} 人升 ${r.agent_next}）`:'（已满级）';
    stats=`<div style="background:var(--bg);border:1px solid var(--gold);border-radius:10px;padding:12px;margin-top:10px;text-align:left;font-size:13px;line-height:1.9;color:var(--text)">
      <div style="color:var(--gold);font-size:14px;font-weight:700">🌟 ${r.agent_name}（${r.agent_level}级）</div>
      <div>一级 ${r.level1_count||0} 人 · 二级 ${r.level2_count||0} 人 · 一级奖励 ${r.total1||0} · 二级奖励 ${r.total2||0} · 累计 ${r.total_commission}（${r.commission_currency==='coins'?'易币':(r.commission_currency==='both'?'易币+易币':'易币')}）</div>
      <div style="color:var(--sub)">${nextTxt}</div>
    </div>`;
    let refs=r.referees||[];
    if(refs.length>0){
      team='<div style="margin-top:12px;text-align:left;font-size:13px;color:var(--gold);font-weight:700">🌳 我的团队</div>'+refs.map(function(rr){
        let vipTag=rr.vip_level>0?`<span style="color:var(--gold)">· VIP${rr.vip_level}</span>`:'';
        let subsHtml=rr.subs&&rr.subs.length>0?`<div style="margin-left:14px;border-left:1px dashed var(--c2);padding-left:10px;margin-top:4px">`+rr.subs.map(function(s){
          let svip=s.vip_level>0?`<span style="color:var(--gold)">· VIP${s.vip_level}</span>`:'';
          return `<div style="font-size:12px;color:var(--sub);padding:3px 0">↳ ${s.name||'未实名'} <span style="color:var(--c2)">#${s.id} · ${s.phone||''}</span> ${svip}</div>`;
        }).join('')+`</div>`:'';
        return `<div style="padding:8px 0;border-bottom:1px solid var(--c2);text-align:left">
          <div style="font-size:14px;color:var(--text);display:flex;justify-content:space-between"><span>${rr.name||'未实名'} <span style="color:var(--c2);font-size:12px">#${rr.id} · ${rr.phone||''}</span> ${vipTag}</span><span style="font-size:12px;color:var(--sub)">${rr.sub_count||0} 个下级</span></div>
          ${subsHtml}
        </div>`;
      }).join('');
    }else{
      team='<p style="color:var(--sub);font-size:12px;margin-top:8px">暂无一级团队成员，快去邀请好友吧～</p>';
    }
  }
  return `<div style="text-align:center;padding:20px">
    <div style="color:var(--sub);font-size:13px">我的邀请码</div>
    <div style="font-size:32px;color:var(--gold);font-weight:700;letter-spacing:3px;margin:8px 0">${code||'-'}</div>
    <div style="color:var(--sub);font-size:12px;margin-bottom:16px">好友通过你的链接注册，你可得邀请奖励易币</div>
    <button class="btn" style="background:var(--gold);color:var(--bg)" onclick="copyInvite('${link}')">复制邀请链接</button>
    ${stats}
    ${team}
  </div>`;
}
async function copyInvite(link){
  try{await navigator.clipboard.writeText(link);alert('已复制邀请链接');}catch(e){prompt('复制此链接',link);}
}
async function panelSettings(){
  let r=await fetch(API+'/api/me',{headers:h()}).then(r=>r.json());
  let u=r.ok?r.user:{};
  return `<div>
    <div style="margin-bottom:8px"><label style="color:var(--sub);font-size:13px">昵称</label><input type="text" id="setName" value="${u.name||''}" placeholder="设置昵称"></div>
    <div style="display:flex;gap:8px">
      <div style="flex:1"><label style="color:var(--sub);font-size:13px">性别</label>
        <select id="setGender"><option value="" ${!u.gender?'selected':''}>未设置</option><option value="男" ${u.gender==='男'?'selected':''}>男</option><option value="女" ${u.gender==='女'?'selected':''}>女</option></select></div>
    </div>
    <div style="margin-bottom:8px"><label style="color:var(--sub);font-size:13px">邮箱</label><input type="email" id="setEmail" value="${u.email||''}" placeholder="选填（可绑定登录）"></div>
    <div style="margin-bottom:8px"><label style="color:var(--sub);font-size:13px">手机号</label><input type="tel" id="setPhone" value="${(u.phone||'').replace(/^\+86/,'')}" placeholder="选填（可绑定登录）"></div>
    <div style="margin-bottom:8px"><label style="color:var(--sub);font-size:13px">地址</label><input type="text" id="setAddr" value="${u.address||''}" placeholder="选填（城市即可）"></div>
    <button class="btn" style="background:var(--gold);color:var(--bg)" onclick="saveProfile()">保存</button>
    <hr style="border:0;border-top:1px solid var(--c2);margin:16px 0">
    <div style="font-weight:700;margin-bottom:8px">🔑 修改密码</div>
    <div style="margin-bottom:8px"><input type="password" id="setPwOld" placeholder="当前密码（旧密码）" autocomplete="current-password"></div>
    <div style="margin-bottom:8px"><input type="password" id="setPwNew" placeholder="新密码（6-8 位）" autocomplete="new-password"></div>
    <div style="margin-bottom:8px"><input type="password" id="setPwConfirm" placeholder="确认新密码" autocomplete="new-password"></div>
    <button class="btn outline" onclick="savePassword()">修改密码</button>
  </div>`;
}
async function savePassword(){
  let o=document.getElementById('setPwOld').value,p=document.getElementById('setPwNew').value,c=document.getElementById('setPwConfirm').value;
  if(!o||!p)return alert('请填写旧密码和新密码');
  if(p.length<6||p.length>8)return alert('新密码需为 6-8 位');
  if(p!==c)return alert('两次输入的新密码不一致');
  let r=await fetch(API+'/api/my/change-password',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({old:o,new:p,confirm:c})}).then(r=>r.json());
  if(!r.ok)return alert(r.msg||'修改失败');
  alert('✅ '+r.msg);
  closePanel();
}
async function saveProfile(){
  // 2026-10-27 第6条：修改个人资料同样需要知情同意
  if(!_privacyAgreed && !(document.getElementById('regPrivacyChk')||{}).checked){
    if(!confirm('修改个人资料前，请确认您已阅读并同意《隐私保护说明》：\n\n· 仅收集与专业服务直接相关的必要信息；\n· 仅用于内部专业分析与服务优化；\n· 不会出售、出租或泄露给任何第三方；\n· 您可随时查询、更正或删除个人信息。\n\n点击「确定」表示同意并继续。')){ return; }
    _privacyAgreed=true;
  }
  let name=document.getElementById('setName').value.trim();
  let gender=document.getElementById('setGender').value;
  let email=document.getElementById('setEmail').value.trim();
  let phone=document.getElementById('setPhone').value.trim();
  let address=document.getElementById('setAddr').value.trim();
  let r=await fetch(API+'/api/my/profile',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({name,gender,email,phone,address})}).then(r=>r.json());
  alert(r.msg||'已保存');
  if(r.ok){closePanel();refreshMe();}
}
function panelTheme(){
  // 兜底：如果 theme.js 未加载（缓存旧版/加载失败），用内置主题列表
  if(!window.YX_THEMES || !window.YX_THEMES.length){
    window.YX_THEMES=[
      {id:'default',name:'原木鎏金',bg:'#1a1612',gold:'#d4af37'},
      {id:'jade',name:'翡翠青绿',bg:'#0f1f1a',gold:'#3fbf8f'},
      {id:'purple',name:'紫微星紫',bg:'#17101f',gold:'#a97fd4'},
      {id:'ocean',name:'沧海幽蓝',bg:'#0e1826',gold:'#5aa7e0'},
      {id:'rose',name:'桃花嫣红',bg:'#1f1216',gold:'#e08aa0'},
      {id:'white',name:'雪白素雅',bg:'#f7f5f0',gold:'#b8860b'},
      {id:'black',name:'玄墨纯黑',bg:'#0a0a0a',gold:'#d4af37'}
    ];
    if(!window.YX_applyTheme){
      window.YX_applyTheme=function(id){
        var th=null;
        for(var i=0;i<window.YX_THEMES.length;i++){if(window.YX_THEMES[i].id===id){th=window.YX_THEMES[i];break;}}
        if(th){document.body.setAttribute('data-theme',id);}
      };
    }
  }
  let themes=window.YX_THEMES||[];
  let cur=document.body.getAttribute('data-theme')||'default';
  if(themes.length===0)return '<p style="color:var(--sub);text-align:center;padding:20px">主题模板加载失败</p>';
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:8px">
    ${themes.map(function(t){
      let active=(cur===t.id);
      return `<div onclick="selectThemeX('${t.id}')" style="cursor:pointer;text-align:center">
        <div style="width:100%;height:64px;border-radius:12px;background:linear-gradient(135deg,${t.bg},${t.gold});border:2px solid ${active?'var(--gold)':'var(--c2)'};position:relative">${active?'<span style="position:absolute;right:4px;top:2px;color:#fff;font-size:16px">✓</span>':''}</div>
        <div style="font-size:12px;color:var(--sub);margin-top:6px">${t.name}</div>
      </div>`;
    }).join('')}
  </div>`;
}
async function selectThemeX(id){
  if(!TOKEN){showAuth();return;}
  if(!USER||USER.vip<=0){alert('主题模板为会员专属，开通会员即可使用');return;}
  if(window.YX_applyTheme)window.YX_applyTheme(id);
  localStorage.setItem('yx_theme',id);
  let r=await fetch(API+'/api/my/theme',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({theme:id})}).then(r=>r.json());
  if(!r.ok){alert(r.msg);return;}
  closePanel();
  showMyPanel('theme');
}
async function panelCircle(){
  let r=await fetch(API+'/api/posts').then(r=>r.json());
  let items=r.ok?(r.items||[]):[];
  let html='<div style="margin-bottom:10px"><input type="text" id="postTitle" placeholder="标题(选填)" style="margin:4px 0"><textarea id="postContent" rows="2" placeholder="分享你的学习心得/求测问题..." style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--c2);color:var(--text);border-radius:8px;margin:4px 0"></textarea><button class="btn" style="background:var(--gold);color:var(--bg)" onclick="publishPost()">发布</button></div>';
  if(items.length===0)return html+'<p style="color:var(--sub);text-align:center;padding:10px">暂无帖子，来发第一帖吧</p>';
  html+='<div style="max-height:400px;overflow-y:auto">';
  html+=items.map(p=>`<div style="padding:12px 0;border-bottom:1px solid var(--c2)">
    <div style="font-size:13px;color:var(--sub)">${p.user_name_masked||'用户'} · ${(p.created_at||'').slice(0,16)}</div>
    ${p.title?`<div style="font-weight:600;margin:4px 0">${p.title}</div>`:''}
    <div style="font-size:14px;line-height:1.6">${p.content}</div>
    <div style="font-size:12px;color:var(--sub);margin-top:6px;cursor:pointer" onclick="showPostComments(${p.id})">💬 ${p.comment_count||0} 评论</div>
  </div>`).join('');
  html+='</div>';
  return html;
}
async function publishPost(){
  if(!TOKEN){showAuth();return;}
  let title=document.getElementById('postTitle').value.trim();
  let content=document.getElementById('postContent').value.trim();
  if(!content)return alert('内容不能为空');
  let r=await fetch(API+'/api/posts',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({title,content})}).then(r=>r.json());
  alert(r.msg||'发布成功');
  showMyPanel('circle');
}
async function showPostComments(pid){
  let r=await fetch(API+'/api/posts/'+pid+'/comments').then(r=>r.json());
  let items=r.ok?(r.items||[]):[];
  let html='<div style="max-height:300px;overflow-y:auto">';
  html+=items.map(c=>`<div style="padding:8px 0;border-bottom:1px solid var(--c2)"><span style="color:var(--gold);font-size:12px">${c.user_name_masked||'用户'}:</span> <span style="font-size:13px">${c.content}</span></div>`).join('');
  html+=items.length===0?'<p style="color:var(--sub);text-align:center;padding:10px">暂无评论</p>':'';
  html+='</div><div style="display:flex;gap:8px;margin-top:10px"><input type="text" id="cmtInput" placeholder="写评论..." style="flex:1"><button class="btn" style="width:auto;background:var(--gold);color:var(--bg)" onclick="addComment('+pid+')">发送</button></div>';
  document.getElementById('panelTitle').textContent='💬 评论';
  document.getElementById('panelBody').innerHTML=html;
}
async function addComment(pid){
  if(!TOKEN){showAuth();return;}
  let content=document.getElementById('cmtInput').value.trim();
  if(!content)return alert('评论不能为空');
  let r=await fetch(API+'/api/posts/'+pid+'/comments',{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({content})}).then(r=>r.json());
  alert(r.msg||'评论成功');
  showPostComments(pid);
}

// ===== 易学闯关小游戏 =====
const QUIZ_DIFF_NAME={easy:'低',medium:'中',hard:'高'};
const QUIZ_DIFF_EMOJI={easy:'🌱',medium:'🔥',hard:'👑'};
let quizData=null, quizIndex=0, quizAnswers=[];
let quizSession=null, quizTimer=null, quizTimeLeft=0, quizStartTs=0;
let _quizLastResult=null, _quizLastElapsed=0;

async function refreshQuizEntry(){
  try{
    let r=await fetch(API+'/api/quiz/today').then(r=>r.json());
    if(!r.ok)return;
    document.getElementById('quizDiffTag').textContent=(QUIZ_DIFF_EMOJI[r.difficulty]||'')+' '+QUIZ_DIFF_NAME[r.difficulty];
    let playedCnt=r.played_count||0, limit=r.daily_limit||1;
    if(r.played){
      document.getElementById('quizSub').textContent=`今日已玩满 · 可玩 ${limit} 次`;
    }else if(playedCnt>0){
      document.getElementById('quizSub').textContent=`今日已玩 ${playedCnt}/${limit} 次`;
    }else{
      document.getElementById('quizSub').textContent='每日答题 · 全对得易币';
    }
  }catch(e){}
}
// 2026-10-29 首页「角色创造」入口：已建过角色直接看自己的角色，没建才走创建流程
function goChar(){
  if(!TOKEN){showAuth();return;}
  location.href='https://tianji.matetechhk.com/char';
}

function openQuiz(){
  if(!TOKEN){showAuth();return;}
  quizData=null;quizIndex=0;quizAnswers=[];
  _quizSubmitting=false;          // 重置提交锁（防止上次未释放卡死）
  if(quizTimer){clearInterval(quizTimer);quizTimer=null;}
  document.getElementById('quizStart').style.display='block';
  document.getElementById('quizPlay').style.display='none';
  document.getElementById('quizResult').style.display='none';
  document.getElementById('quizProgress').textContent='第 1 / ? 题';   // 重置进度（算了吗 2026-10-10 反馈「提交中...」卡在 element 上）
  document.getElementById('quizStartInfo').textContent='加载今日题目...';
  document.getElementById('quizModal').classList.add('show');
  loadQuizToday();
}
function closeQuiz(){
  if(quizTimer){clearInterval(quizTimer);quizTimer=null;}
  _quizSubmitting=false;          // 关闭弹层时也释放锁
  document.getElementById('quizModal').classList.remove('show');
  // 关闭后立刻重置进度（再次开 modal 时不显示残留「提交中...」）
  var p=document.getElementById('quizProgress');
  if(p)p.textContent='第 1 / ? 题';
}
async function loadQuizToday(){
  let r=await fetch(API+'/api/quiz/today',{headers:h()}).then(r=>r.json());
  if(!r.ok){document.getElementById('quizStartInfo').textContent=r.msg||'加载失败';return;}
  quizData=r;
  let diffName=QUIZ_DIFF_NAME[r.difficulty]||'';
  let limit=r.daily_limit||1, playedCnt=r.played_count||0;
  if(r.played){
    document.getElementById('quizStartInfo').innerHTML=`今日已玩满 ${limit} 次！<br>难度：${diffName} · 最近答对 ${r.last_score||0}/${r.last_total||0}<br><span style="color:var(--sub)">明天再来挑战吧～</span>`;
  }else{
    document.getElementById('quizStartInfo').innerHTML=`今日难度：<b style="color:var(--gold)">${diffName}</b> ｜ 共 ${r.question_count} 题 ｜ 限时 ${r.time_limit} 秒<br>已玩 ${playedCnt}/${limit} 次<br><span style="color:var(--sub)">全对可得易币奖励（按难度浮动）</span>`;
  }
}
function startQuiz(){
  if(!quizData||quizData.played){closeQuiz();return;}
  document.getElementById('quizStart').style.display='none';
  document.getElementById('quizPlay').style.display='block';
  document.getElementById('quizDiffBadge').textContent='难度：'+(QUIZ_DIFF_NAME[quizData.difficulty]||'');
  // 调 start 接口取题目 + 会话
  startQuizSession();
}
async function startQuizSession(){
  let r=await fetch(API+'/api/quiz/start',{method:'POST',headers:h()}).then(r=>r.json());
  if(!r.ok){alert(r.msg||'开始失败');closeQuiz();return;}
  quizSession=r;
  quizIndex=0;quizAnswers=[];
  quizTimeLeft=r.time_limit||30;
  quizStartTs=Date.now();
  startTimer();
  renderQuizQuestion();
}
function startTimer(){
  if(quizTimer)clearInterval(quizTimer);
  updateTimerUI();
  quizTimer=setInterval(()=>{
    quizTimeLeft--;
    updateTimerUI();
    if(quizTimeLeft<=0){
      clearInterval(quizTimer);quizTimer=null;
      // 超时自动提交（以当前已答为准）
      submitQuiz(true);
    }
  },1000);
}
function updateTimerUI(){
  let el=document.getElementById('quizTimer');
  if(!el)return;
  el.textContent='⏱ '+Math.max(0,quizTimeLeft)+'s';
  el.style.color=quizTimeLeft<=10?'var(--red)':'var(--gold)';
}
function renderQuizQuestion(){
  let q=quizSession.questions[quizIndex];
  document.getElementById('quizProgress').textContent=`第 ${quizIndex+1} / ${quizSession.questions.length} 题`;
  document.getElementById('quizQuestion').textContent=q.question;
  document.getElementById('quizOptions').innerHTML=q.options.map((op,i)=>{
    return `<button class="quiz-opt" onclick="answerQuiz(${i})">${'ABCD'[i]} · ${op}</button>`;
  }).join('');
}
function answerQuiz(choice){
  let q=quizSession.questions[quizIndex];
  quizAnswers.push({id:q.id,choice:choice});
  if(window.SFX)SFX.click();
  quizIndex++;
  if(quizIndex<quizSession.questions.length){renderQuizQuestion();}
  else{submitQuiz(false);}
}
async function submitQuiz(isTimeout){
  // 防止重复提交（算了吗 2026-10-10 反馈「最後的提交卡機」—— 多次点会触发多个 fetch）
  if(_quizSubmitting)return;
  _quizSubmitting=true;
  if(quizTimer){clearInterval(quizTimer);quizTimer=null;}
  let elapsed=Math.round((Date.now()-quizStartTs)/1000);
  document.getElementById('quizProgress').textContent='提交中...';
  // 25 秒硬超时 — 防止 fetch 挂死导致「卡機」
  let _ctrl=new AbortController();
  let _t=setTimeout(()=>_ctrl.abort(), 25000);
  let r;
  try{
    let _resp=await fetch(API+'/api/quiz/submit',{method:'POST',
      headers:{...h(),'Content-Type':'application/json'},
      body:JSON.stringify({session_id:quizSession.session_id,answers:quizAnswers,elapsed:elapsed}),
      signal:_ctrl.signal});
    let _txt=await _resp.text();
    try{r=JSON.parse(_txt);}catch(_pe){r={ok:false,msg:_resp.status===500?'服务器繁忙，请重试':'返回格式异常'};}
  }catch(e){
    clearTimeout(_t);_quizSubmitting=false;
    document.getElementById('quizProgress').textContent='第 1 / '+(quizSession.questions?quizSession.questions.length:'?')+' 题';
    alert('提交失败：'+(e&&e.name==='AbortError'?'超时（25s），请检查网络后重试':'网络异常，请重试'));
    closeQuiz();
    return;
  }
  clearTimeout(_t);
  if(!r.ok){_quizSubmitting=false;document.getElementById('quizProgress').textContent='第 1 / '+(quizSession.questions?quizSession.questions.length:'?')+' 题';alert(r.msg||'提交失败');closeQuiz();return;}
  document.getElementById('quizPlay').style.display='none';
  document.getElementById('quizResult').style.display='block';
  if(window.SFX){ (r.perfect && !r.overtime)?SFX.win():(r.overtime?SFX.lose():SFX.lose()); }
  if(r.overtime){
    document.getElementById('quizResultEmoji').textContent='⏱️';
    document.getElementById('quizResultTitle').textContent='超时了！';
    document.getElementById('quizResultReward').textContent='未获得易币';
  }else if(r.incomplete){
    // 2026-10-26 修（第1条）：没答完不能再显示「未全对」糊弄过去，要明确说清答了几题
    document.getElementById('quizResultEmoji').textContent='📝';
    document.getElementById('quizResultTitle').textContent='未答完，本次不通过';
    document.getElementById('quizResultReward').textContent=r.msg||'需答完全部题目才能通关';
  }else if(r.perfect){
    document.getElementById('quizResultEmoji').textContent='🎉';
    document.getElementById('quizResultTitle').textContent='全对通关！';
    // 2026-10-30：reward 现在是服务端「实际到账」金额；被每日上限截断时如实说明，不再假装全额。
    var _rw=(typeof r.reward==='number')?r.reward:0;
    var _want=(typeof r.want_yibi==='number')?r.want_yibi:_rw;
    if(r.capped && _rw<_want){
      document.getElementById('quizResultReward').innerHTML='應發 '+_want+' 易幣 ｜ <span style="color:#ffb08a">實發 '+_rw+'</span><br><span style="font-size:11px;color:#ffb08a">今日「易學闯关」額度已達'+(r.cap?('（上限 '+r.cap+'）'):'')+'，明天 0 點重置</span>';
    }else{
      document.getElementById('quizResultReward').textContent='+'+_rw+' 易币';
    }
  }else{
    document.getElementById('quizResultEmoji').textContent='😅';
    document.getElementById('quizResultTitle').textContent='未全对';
    document.getElementById('quizResultReward').textContent='需全部答对才能获得易币';
  }
  document.getElementById('quizResultDetail').textContent=`答对 ${r.score}/${r.total} 题 ｜ 难度：${QUIZ_DIFF_NAME[r.difficulty]||''} ｜ 用时 ${elapsed} 秒`;
  document.getElementById('quizResultExplain').innerHTML=(r.details||[]).map((d,i)=>{
    return `<div class="quiz-explain-item" style="background:${d.correct?'rgba(74,136,0,0.15)':'rgba(193,67,47,0.15)'}"><b>${d.correct?'✅':'❌'} 第${i+1}题</b><br>${d.explain||''}</div>`;
  }).join('');
  // 分享带邀请码
  document.getElementById('quizShareBox').style.display = USER && USER.invite_code ? 'block' : 'none';
  _quizLastResult=r; _quizLastElapsed=elapsed;
  var _qDiffName=QUIZ_DIFF_NAME[r.difficulty]||'';
  if(window.UnifiedShare&&UnifiedShare.actions)
    UnifiedShare.actions(document.getElementById('usActionMount'),
      {tool:'易学闯关',name:'闯关成绩',score:r.score,level:'答对 '+r.total+' 题',
       subtitle:_qDiffName+'难度'+(r.reward>0?(' · +'+r.reward+' 易币'):'')});
  refreshQuizEntry();
}

// ===== 闯关分享（带邀请码）=====
let _quizInviteCode='';
function _quizRef(){
  if(_quizInviteCode)return _quizInviteCode;
  if(USER && USER.invite_code){_quizInviteCode=USER.invite_code;return _quizInviteCode;}
  return '';
}
async function _ensureQuizRef(){
  if(_quizRef())return _quizRef();
  try{
    let r=await fetch(API+'/api/me',{headers:h()}).then(r=>r.json());
    if(r.ok&&r.user&&r.user.invite_code){_quizInviteCode=r.user.invite_code;}
  }catch(e){}
  return _quizRef();
}
function _quizShareLink(){
  return 'https://tianji.matetechhk.com'+'/xuetang?ref='+_quizRef();
}
async function shareQuizResult(){
  let ref=await _ensureQuizRef();
  if(!ref){alert('登录后即可分享邀请链接');return;}
  let link=_quizShareLink();
  let text='我在算了吗闯关挑战，一起测测你的易学功力吧！';
  try{
    if(navigator.share){
      await navigator.share({title:'算了吗闯关',text:text,url:link});
      return;
    }
  }catch(e){}
  copyQuizLink();
}
async function copyQuizLink(){
  let ref=await _ensureQuizRef();
  if(!ref){alert('登录后即可分享邀请链接');return;}
  let link=_quizShareLink();
  try{await navigator.clipboard.writeText(link);alert('邀请链接已复制，好友通过它注册你将获得易币奖励');}
  catch(e){prompt('复制此链接',link);}
}

// ===== 闯关分享海报（统一：姓名 + 分数 + 等级 + 邀请码二维码）=====
function closeSharePoster(){var ov=document.getElementById('usPosterOverlay');if(ov)ov.style.display='none';}
async function shareQuizPoster(){
  let ref=await _ensureQuizRef();
  if(!ref){alert('登录后即可生成分享海报');return;}
  if(!_quizLastResult){alert('暂无闯关成绩');return;}
  let r=_quizLastResult;
  let diffName=QUIZ_DIFF_NAME[r.difficulty]||'';
  UnifiedShare.open({
    tool:'易学闯关',
    name:'闯关成绩',
    score:r.score,
    level:'答对 '+r.total+' 题',
    subtitle:diffName+'难度'+(r.reward>0?(' · +'+r.reward+' 易币'):'')
  });
}

// INIT
renderCats();
loadBanners();
if(COURSE_ONLINE){loadCourses();loadFreeList();}else{showCourseSoon('course_soon','');}

/* 深链兜底：旧链接/分享链/缓存直进详情页或播放页 → 提示「该课程暂未开放」并退回课程首页 */
(function(){
  if(COURSE_ONLINE)return;
  function _dlCheck(){
    try{
      var hh=(location.hash||'').toLowerCase().replace(/^#/,'');
      var q=location.search||'';
      var hasCid=/[?&](cid|course_id|course)=/i.test(q);
      var hashCourse=!!hh&&hh!=='me'&&hh!=='tianji'&&hh!=='login'&&(hh.indexOf('detail')>=0||hh.indexOf('player')>=0||hh.indexOf('course')>=0);
      if(hasCid||hashCourse){setTimeout(function(){courseNotOpen();},50);}
    }catch(e){}
  }
  _dlCheck();
  window.addEventListener('hashchange',_dlCheck);
})();
refreshQuizEntry();
loadToolStatus();

// 保持登录：自动用已保存的账号密码登录
(function(){
  try{
    if(localStorage.getItem('yx_keep')!=='1')return;
    if(TOKEN)return;
    var acct=localStorage.getItem('yx_acct')||'', sp=localStorage.getItem('yx_pw')||'';
    if(!acct||!sp)return;
    fetch(API+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:acct,password:decodeURIComponent(escape(atob(sp)))})}).then(function(r){return r.json();}).then(function(r){
      if(!r.ok)return;
      TOKEN=r.token;USER=r.user;localStorage.setItem('yx_tk',TOKEN);
      try{var exp=new Date(Date.now()+3650*24*3600*1000).toUTCString();document.cookie='yx_tk='+TOKEN+';expires='+exp+';path=/;SameSite=Lax';}catch(e){}
      loadCourses();
      if(mainTab==='me')refreshMe();
    }).catch(function(){});
  }catch(e){}
})();

// 启动即校正「我的」页登录态（修复：打开 App 显示未登录、需先退出才出现登录界面）
try{ refreshMe(); }catch(e){}

// 按上架/下架状态渲染天机宫格（下架工具隐藏）
async function loadToolStatus(){
  const grid=document.getElementById('tianjiGrid');
  if(!grid)return;
  try{
    const r=await fetch('/api/tools').then(r=>r.json());
    if(!r.ok || !r.items)return;
    const statusMap={};
    r.items.forEach(t=>statusMap[t.tool]=t.status===1);
    grid.querySelectorAll('.tj[data-tool]').forEach(el=>{
      const tool=el.getAttribute('data-tool');
      if(statusMap[tool]===false) el.style.display='none';
    });
  }catch(e){}
}

// hash 直达（/xuetang#me 切「我的」，#tianji 切「天机」tab）
(function(){
  function applyHash(){
    const h=location.hash.replace('#','');
    /* 2026-11-11：补全 home/course 分支。
       原来只处理 me/tianji，导致从 #me 浏览器前进/后退到 #home 时
       页面仍停在「我的」，返回链路终点状态不对。 */
    if(h==='home'){switchMainTab('home');}
    else if(h==='course'){switchMainTab('course');}
    else if(h==='me'){switchMainTab('me');}
    else if(h==='tianji'){switchMainTab('tianji');}
    else if(h==='login'){
      try{
        if(document.getElementById('authModal')){
          if(sessionStorage.getItem('__reg')==='1'){ sessionStorage.removeItem('__reg'); switchAuth('reg'); }
          else showAuth('请先登录后再使用工具');
        }
      }catch(e){}
    }
  }
  applyHash();
  window.addEventListener('hashchange',applyHash);
})();

// ===== 断网兜底（2026-11-14）：无本地副本的入口，断网时明确提示，不白屏 =====
function goRemote(name, url){
  var offline = false;
  try { offline = (navigator.onLine === false); } catch(e) {}
  if(offline){
    try {
      if(window.Yibi && Yibi.resolveGameUrl){ /* 复用离线判断 */ }
    } catch(e){}
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:9999;background:rgba(20,15,8,.95);color:#f5e6c8;border:1px solid rgba(212,175,55,.55);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;max-width:80%;text-align:center';
    d.textContent='📶 '+name+' 需聯網遊玩，請恢復網絡後再進入';
    document.body.appendChild(d);
    setTimeout(function(){ try{document.body.removeChild(d);}catch(e){} },3200);
    return;
  }
  location.href=url;
}
function goOfflineGuard(name, fn){
  var offline = false;
  try { offline = (navigator.onLine === false); } catch(e) {}
  if(offline){
    var d=document.createElement('div');
    d.style.cssText='position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:9999;background:rgba(20,15,8,.95);color:#f5e6c8;border:1px solid rgba(212,175,55,.55);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;max-width:80%;text-align:center';
    d.textContent='📶 '+name+' 需聯網遊玩，請恢復網絡後再進入';
    document.body.appendChild(d);
    setTimeout(function(){ try{document.body.removeChild(d);}catch(e){} },3200);
    return;
  }
  if(typeof fn==='function') fn();
}
