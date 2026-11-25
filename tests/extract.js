// Wyciąga skrypt z index.html do tests/game.js (potrzebne dla sim.js)
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync(path.join(__dirname,'game.js'),m[m.length-1][1]);
