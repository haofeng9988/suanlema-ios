// 算了吗 · 全局主题模板（7套配色）
// 供所有页面引用：index.html / xuetang.html / mall.html / rank.html
(function(){
  var THEMES=[
    {id:'default',name:'原木鎏金',bg:'#1a1612',c1:'#2a2218',c2:'#3a2e1e',gold:'#d4af37',red:'#c1432f',text:'#e8dcc8',sub:'#9a8a6a',green:'#4a8'},
    {id:'jade',name:'翡翠青绿',bg:'#0f1f1a',c1:'#162b23',c2:'#1f3d32',gold:'#3fbf8f',red:'#c0392b',text:'#d8ede4',sub:'#7aa894',green:'#3fbf8f'},
    {id:'purple',name:'紫微星紫',bg:'#17101f',c1:'#221830',c2:'#332047',gold:'#a97fd4',red:'#c0392b',text:'#e8dcf0',sub:'#9a82b8',green:'#7fbfa0'},
    {id:'ocean',name:'沧海幽蓝',bg:'#0e1826',c1:'#14233a',c2:'#1c3050',gold:'#5aa7e0',red:'#c1432f',text:'#d8e4f0',sub:'#7a9ab8',green:'#4aa8a0'},
    {id:'rose',name:'桃花嫣红',bg:'#1f1216',c1:'#2b1820',c2:'#3d2230',gold:'#e08aa0',red:'#c1432f',text:'#f0dce4',sub:'#b88294',green:'#7fbf8f'},
    {id:'white',name:'雪白素雅',bg:'#f7f5f0',c1:'#ffffff',c2:'#e5e0d5',gold:'#b8860b',red:'#c1432f',text:'#2a2218',sub:'#8a7a5a',green:'#4a8'},
    {id:'black',name:'玄墨纯黑',bg:'#0a0a0a',c1:'#141414',c2:'#262626',gold:'#d4af37',red:'#c1432f',text:'#e8e8e8',sub:'#8a8a8a',green:'#4a8'}
  ];
  function applyTheme(id){
    var th=null;
    for(var i=0;i<THEMES.length;i++){if(THEMES[i].id===id){th=THEMES[i];break;}}
    if(!th)th=THEMES[0];
    var root=document.documentElement;
    root.style.setProperty('--bg',th.bg);
    root.style.setProperty('--c1',th.c1);
    root.style.setProperty('--c2',th.c2);
    root.style.setProperty('--gold',th.gold);
    root.style.setProperty('--red',th.red);
    root.style.setProperty('--text',th.text);
    root.style.setProperty('--sub',th.sub);
    root.style.setProperty('--green',th.green);
    var meta=document.querySelector('meta[name=theme-color]');
    if(meta)meta.content=th.bg;
    // body 可能尚未加载（脚本在 head 中执行），安全设置
    if(document.body)document.body.setAttribute('data-theme',id);
    try{localStorage.setItem('yx_theme',id);}catch(e){}
  }
  // 先暴露全局变量（避免下方 applyTheme 抛错导致变量未挂载）
  window.YX_THEMES=THEMES;
  window.YX_applyTheme=applyTheme;
  // 从 localStorage 读取已保存主题，DOM 就绪后再应用
  function bootTheme(){
    var saved=null;
    try{saved=localStorage.getItem('yx_theme');}catch(e){}
    if(saved)applyTheme(saved);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bootTheme);
  }else{
    bootTheme();
  }
})();
