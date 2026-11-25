const fs=require('fs');
const js=fs.readFileSync(require('path').join(__dirname,'game.js'),'utf8');
const mk=()=>new Proxy(function(){},{get:(t,k)=>k==='getContext'?()=>mk():k==='closest'?()=>null:k==='getBoundingClientRect'?()=>({left:0,top:0,width:960,height:576}):mk(),set:()=>true,apply:()=>mk()});
global.window=global;window.__TEST=true;window.devicePixelRatio=1;
const store={};global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}};
const els={};global.document={getElementById:id=>els[id]||(els[id]=mk()),addEventListener(){},createElement:()=>mk()};
global.requestAnimationFrame=()=>{};
require(require('path').join(__dirname,'game.js'));
const G=window.__game;
function cellsNearPath(s){const out=[];for(let c=0;c<30;c++)for(let r=0;r<18;r++){if(!G.validCell(c,r))continue;let best=1e9,bi=0;s.path.pts.forEach((p,i)=>{});
  // distance to path polyline samples
  for(let d=0;d<s.path.len;d+=16){const seg=s.path.segs.find(sg=>d<=sg.s+sg.l)||s.path.segs[s.path.segs.length-1];const t=(d-seg.s)/seg.l;const x=seg.a.x+(seg.b.x-seg.a.x)*t,y=seg.a.y+(seg.b.y-seg.a.y)*t;const dd=Math.hypot(c*32+16-x,r*32+16-y);if(dd<best){best=dd;bi=d}}
  if(best<=50)out.push({c,r,score:bi/s.path.len+Math.random()*.15});}
  return out.sort((a,b)=>b.score-a.score)}
function run(castle,diff){
  G.setCastle(castle);G.setDiff(diff);G.newRun();const S=()=>G.S;S().modal=null;let steps=0,mid=0;
  while(!S().modal||S().modal==='cards'){
    const s=S();
    if(s.modal==='cards'){if(s.hc&&s.phase==='wave')mid++;G.pickCard(0);continue}
    if(s.phase==='build'){
      const cells=cellsNearPath(s);let i=0;
      const pref=['arrow','cannon','frost','tesla','laser','mortar','poison','sniper'];
      let n=0;
      while(i<cells.length&&n<40){const ty=pref[(s.towers.length+n)%(s.wave<2?2:pref.length)];if(s.gold<G.towerCost(ty))break;s.build=ty;G.tryBuild(cells[i].c,cells[i].r);i++;n++}
      
      G.startWave();
    }
    if(S().rq.length&&!S().modal){G.lvToggle();G.lvPick(0);if(G.S.lvOpen){G.lvToggle()}}G.update(0.05);
    if(++steps>500000)throw new Error('stuck');
  }
  const s=S();return {res:s.result,wave:s.wave,hp:s.baseHp,mid,lvl:s.hero.lvl};
}
for(const d of ['normal','hard','hardcore']){const rs=[];for(let i=0;i<10;i++)rs.push(run(G.CASTLES[i%8].id,d));
 console.log(d,'win',rs.filter(r=>r.res==='win').length+'/10','waves',rs.map(r=>r.wave).join(','),'mid',rs.reduce((a,r)=>a+r.mid,0))}
// leaks per wave on hard (20 hp) for the smart bot
for(let k=0;k<4;k++){
  G.setCastle(G.CASTLES[k].id);G.setDiff('hard');G.newRun();const S=()=>G.S;S().modal=null;const loss=[];let prev=S().baseHp;let steps=0;
  while(S().wave<5&&S().modal!=='end'){
    const s=S();
    if(s.modal==='cards'){G.pickCard(0);continue}
    if(s.phase==='build'){
      if(s.wave>0){loss.push(prev-s.baseHp);prev=s.baseHp}
      const cells=cellsNearPath(s);let i=0,n=0;const pref=['arrow','cannon','frost','tesla','laser','mortar','poison','sniper'];
      while(i<cells.length&&n<40){const ty=pref[(s.towers.length+n)%(s.wave<2?2:pref.length)];if(s.gold<G.towerCost(ty))break;s.build=ty;G.tryBuild(cells[i].c,cells[i].r);i++;n++}
      G.startWave();
    }
    if(S().rq.length&&!S().modal){G.lvToggle();G.lvPick(0);if(G.S.lvOpen){G.lvToggle()}}G.update(.05);if(++steps>200000)break;
  }
  console.log('loss per wave',loss.join(','),'towers',S().towers.length,'gold',Math.floor(S().gold));
}
