const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
fs.writeFileSync(require('path').join(__dirname,'game.js'),js);
const errors=new Set();
function chk(name,args){
  args.forEach((a,i)=>{
    if(typeof a==='number'&&!Number.isFinite(a))errors.add(name+': non-finite arg '+i);
    if(typeof a==='string'&&/NaN|undefined|Infinity/.test(a))errors.add(name+': bad string '+a);
  });
  if(name==='arc'&&args[2]<0)errors.add('arc negative radius '+args[2]);
  if(name==='ellipse'&&(args[2]<0||args[3]<0))errors.add('ellipse negative radius');
  if(name==='fillRect'||name==='strokeRect'){}
}
function strict(){
  const state={};
  const grad={addColorStop(o,c){chk('stop',[o,c])}};
  return new Proxy(state,{
    get(t,k){
      if(k==='createRadialGradient'||k==='createLinearGradient')return (...a)=>{chk(String(k),a);return grad};
      if(k in t)return t[k];
      return (...a)=>{chk(String(k),a)};
    },
    set(t,k,v){if(typeof v==='string'&&/NaN|undefined|Infinity/.test(v))errors.add('set '+String(k)+' bad value '+v);if(typeof v==='number'&&!Number.isFinite(v))errors.add('set '+String(k)+' non-finite');t[k]=v;return true}
  });
}
const mk=()=>new Proxy(function(){},{get:(t,k)=>k==='getContext'?()=>strict():k==='closest'?()=>null:k==='getBoundingClientRect'?()=>({left:0,top:0,width:960,height:576}):mk(),set:()=>true,apply:()=>mk()});
global.window=global;window.__TEST=true;window.devicePixelRatio=1;
const store={};global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}};
const els={};global.document={getElementById:id=>els[id]||(els[id]=mk()),addEventListener(){},createElement:()=>mk()};
global.requestAnimationFrame=()=>{};
require(require('path').join(__dirname,'game.js'));
const G=window.__game;
const CAST=G.CASTLES.map(c=>c.id);
for(const cid of CAST){
  G.setCastle(cid);G.newRun();const S=G.S;
  for(const k of G.TKEYS){
    for(const lvl of [1,3,5])for(const t of [0,1.3,7.9,55.5])for(const rec of [0,.05,.16])for(const ang of [-1.57,0,2.4,3.1])for(const ramp of [0,1,2]){
      drawArgs(S,k,lvl,t,rec,ang,ramp,cid);
    }
  }
}
function drawArgs(S,k,lvl,t,rec,ang,ramp,cid){const g=strict();G.drawTower(g,k,40,40,1.22,t,ang,rec,lvl,ramp,lvl===3,S.skin[k])}
// castles and enemies
for(const c of G.CASTLES){for(const t of [0,2.2,9.7]){G.drawCastle(strict(),c,40,40,1.5,t,{ang:-.5,rec:.1,hit:.2,low:true});G.drawCastle(strict(),c,40,40,1.5,t,{ang:2,rec:0,hit:0,low:false})}}
[['sultan',24],['hunter',13],['god',20]].forEach(b=>{for(const t of [0,1,5.5])for(const fl of [0,.1])G.drawEnemy(strict(),{type:'boss',bid:b[0],bn:'x',x:5,y:5,r:b[1],color:'#fff',flash:fl,ph:1,hp:5,max:10,ang:fl?3:0,dg:fl},t)});
Object.keys(G.ENEMY).forEach(k=>{for(const t of [0,1,5.5])G.drawEnemy(strict(),{type:k,x:5,y:5,r:G.ENEMY[k].r,color:'#fff',flash:0,ph:1,hp:5,max:10},t)});
console.log('errors:',errors.size);errors.forEach(e=>console.log(' ',e));
