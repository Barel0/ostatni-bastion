// Mądrzejszy bot do kalibracji trudności (pokrycie ścieżki, wydawanie całego złota, rozsądny wybór kart).
// Użycie: node tests/extract.js && node tests/smart.js [runów] [easy,normal,hard,hardcore]
const path=require('path');
const gamePath=path.join(__dirname,'game.js');
const N=+process.argv[2]||32;
const mk=()=>new Proxy(function(){},{get:(t,k)=>k==='getContext'?()=>mk():k==='closest'?()=>null:k==='getBoundingClientRect'?()=>({left:0,top:0,width:960,height:576}):mk(),set:()=>true,apply:()=>mk()});
global.window=global;window.__TEST=true;window.devicePixelRatio=1;
const store={};global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}};
const els={};global.document={getElementById:id=>els[id]||(els[id]=mk()),addEventListener(){},createElement:()=>mk()};
global.requestAnimationFrame=()=>{};
require(gamePath);
const G=window.__game;
const RANGE={arrow:105,cannon:120,frost:100,sniper:230,tesla:105,poison:100,mortar:270,laser:125};
function samples(s){const pts=[];for(let d=0;d<s.path.len;d+=10){const seg=s.path.segs.find(sg=>d<=sg.s+sg.l)||s.path.segs[s.path.segs.length-1];const t=(d-seg.s)/seg.l;pts.push({x:seg.a.x+(seg.b.x-seg.a.x)*t,y:seg.a.y+(seg.b.y-seg.a.y)*t,w:1})}return pts}
function bestCell(s,type,pts){
  const r=RANGE[type]*.92;let best=null,bs=-1;
  for(let c=0;c<30;c++)for(let rr=0;rr<18;rr++){
    if(!G.validCell(c,rr))continue;
    const x=c*32+16,y=rr*32+16;let sc=0;
    for(const p of pts){if(Math.hypot(p.x-x,p.y-y)<=r)sc+=1}
    // bonus za bliskość końca ścieżki (tam zbiera się ogień zamku)
    if(sc>bs){bs=sc;best={c,r:rr}}
  }
  return best;
}
// kolejność budowy: ratio typów
const ORDER=['arrow','frost','cannon','tesla','cannon','laser','arrow','frost','mortar','tesla','sniper','laser','cannon','poison','arrow','tesla'];
function lvlScore(c,S){
  const id=c.id;
  if(c.k==='skill')return 9;
  const m={h_dmg:8,h_rate:8,h_range:5,h_hp:4,h_xp:3,h_crit:7,h_multi:9,i_gold:6,i_watch:3,i_lens:7,i_gear:8,i_torch:4,i_storm:5,i_aura:6,i_gem:9,e_gold:5,e_big:7,e_hp:2};
  return m[id]||1;
}
function waveScore(c,S){
  if(c.tw){const n=S.towers.filter(t=>t.type===c.tw).length;return 5+n*2+(c.nl>=3?1:0)}
  const m={t_dmg:7,t_rate:7,t_range:6,t_cost:5};return m[c.id]||1;
}
function claim(){
  const S=G.S;
  while(S.rq.length&&!S.modal){
    const before=S.rq.length;
    G.lvToggle();
    if(!S.lvOpen||!S.lvCards)break;
    const isWave=S.lvKind==='wave';
    let bi=0,bs=-1;S.lvCards.forEach((c,i)=>{const sc=isWave?waveScore(c,S):lvlScore(c,S);if(sc>bs){bs=sc;bi=i}});
    G.lvPick(bi);
    if(S.rq.length>=before)break;
  }
}
function run(cid,diff){
  G.setCastle(cid);G.setDiff(diff);G.newRun();G.S.modal=null;
  let steps=0,lossW=[],prev=null,goldAt=[];
  const pts=samples(G.S);
  while(!G.S.modal){
    const s=G.S;
    if(s.phase==='build'){
      claim();
      if(prev!==null){lossW.push(prev-s.baseHp)}prev=s.baseHp;
      // buduj
      let n=0;
      while(n<60){
        const k=s.towers.length;
        // wybór typu: pierwszy z ORDER, na który stać
        let ty=ORDER[k%ORDER.length];
        if(s.wave<2&&k<2)ty=['arrow','frost'][k];
        if(s.gold<G.towerCost(ty)){break}
        const cell=bestCell(s,ty,pts);if(!cell)break;
        s.build=ty;const g0=s.towers.length;G.tryBuild(cell.c,cell.r);if(s.towers.length===g0)break;n++;
      }
      s.build=null;
      goldAt.push(Math.floor(s.gold));
      G.startWave();
    }
    if(G.S.rq.length&&!G.S.modal&&G.S.phase==='build')claim();
    G.update(.05);
    if(++steps>400000)throw new Error('stuck');
  }
  const s=G.S;return {res:s.result,wave:s.wave,hp:s.baseHp,loss:lossW,gold:goldAt,score:s.score,lvl:s.hero.lvl,towers:s.towers.length};
}
const CASTS=G.CASTLES.map(c=>c.id);
const diffs=(process.argv[3]||'easy,normal,hard,hardcore').split(',');
for(const d of diffs){
  const rs=[];for(let i=0;i<N;i++)rs.push(run(CASTS[i%CASTS.length],d));
  const wins=rs.filter(r=>r.res==='win').length;
  const avgW=(rs.reduce((a,r)=>a+r.wave,0)/N).toFixed(1);
  // średnia strata HP w falach 1..15
  const L=[];for(let w=0;w<15;w++){const v=rs.map(r=>r.loss[w]).filter(x=>x!==undefined);L.push(v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'-')}
  const G2=[];for(let w=0;w<15;w++){const v=rs.map(r=>r.gold[w]).filter(x=>x!==undefined);G2.push(v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):'-')}
  console.log(d.padEnd(8),'wygrane',wins+'/'+N,'śr.fala',avgW,'śr.HP końc.',(rs.reduce((a,r)=>a+r.hp,0)/N).toFixed(1),'wieże',(rs.reduce((a,r)=>a+r.towers,0)/N).toFixed(0));
  console.log('   strata HP/falę:',L.join(' '));
  console.log('   złoto na starcie fali:',G2.join(' '));
  console.log('   wyniki:',rs.map(r=>r.wave+(r.res==='win'?'W':'')).join(','));
}
