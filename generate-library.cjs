// Finds .gba files in the root or games/ folder before GitHub Pages deployment.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const records = [];
for (const dir of ['', 'games']) {
  const folder = path.join(root, dir);
  if (!fs.existsSync(folder)) continue;
  for (const file of fs.readdirSync(folder)) {
    if (!fs.statSync(path.join(folder, file)).isFile()) continue;
    records.push({file, dir, path:(dir ? dir + '/' : '') + encodeURIComponent(file)});
  }
}
const norm = s => s.replace(/(\))ico$/i,'$1.ico').replace(/\.[^.]+$/,'').toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ')
  .replace(/pok[eé]mon|pokemon|version|gameboy|advance|usa|europe|english|rev\s*\d+/gi,' ')
  .replace(/[^a-z0-9]/g,'');
function dist(a,b){let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[b.length];}
function confidence(a,b){if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length)>=.6?.93:0;return 1-dist(a,b)/Math.max(a.length,b.length);}
const icons=records.filter(x=>/(?:\.ico|\)ico)$/i.test(x.file));
const roms=records.filter(x=>/\.gba$/i.test(x.file)).sort((a,b)=>a.file.localeCompare(b.file));
function pickIcon(rom){const q=norm(rom.file);const ranked=icons.map(x=>({x,v:confidence(q,norm(x.file))})).sort((a,b)=>b.v-a.v);if(!ranked.length||ranked[0].v<.78)return null;if(ranked[1]&&ranked[0].v-ranked[1].v<.07)return null;return ranked[0].x.path;}
const seen = new Set();
const library=[];
for(const rom of roms){const emerald=rom.file.toLowerCase()==='pokemonemerald.gba';const key=emerald?'emerald':'user:'+rom.file.toLowerCase();if(seen.has(key)) {console.warn('Duplicate game filename skipped:',rom.file);continue;}seen.add(key);library.push({id:key,name:emerald?'Pokémon Emerald':rom.file.replace(/\.gba$/i,'').replace(/_/g,' ').trim(),file:rom.path,icon:pickIcon(rom)});}
fs.writeFileSync(path.join(root,'games.json'),JSON.stringify(library,null,2)+'\n');
console.log(`GBA library: found ${library.length} game(s).`);
for(const g of library)console.log(' - '+g.name+' ('+g.file+')');
