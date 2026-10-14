// Build-time game library generator. Only include game files you are permitted to host.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const gamesDir = path.join(root, 'games');
if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, {recursive:true});
const files = fs.readdirSync(gamesDir).filter(f => fs.statSync(path.join(gamesDir,f)).isFile());
const roms = files.filter(f => /\.gba$/i.test(f)).sort((a,b)=>a.localeCompare(b));
const icons = files.filter(f => /\.ico$/i.test(f));
const normalize = s => s.replace(/\.[^.]+$/,'').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/pok[eé]mon|pokemon|version|gameboy|advance|usa|europe|english|rev\s*\d+/gi,' ').replace(/[^a-z0-9]/g,'');
function distance(a,b) {
  let previous = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    let current = [i];
    for(let j=1;j<=b.length;j++) current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
    previous=current;
  }
  return previous[b.length];
}
const score = (a,b) => {
  if (!a || !b) return 0;
  if (a===b) return 1;
  // Require substantial overlap so Ruby never accidentally gets FireRed's artwork.
  if (a.includes(b) || b.includes(a)) return Math.min(a.length,b.length)/Math.max(a.length,b.length) >= .6 ? .93 : 0;
  return 1-distance(a,b)/Math.max(a.length,b.length);
};
function iconFor(rom) {
  const stem=normalize(rom);
  const matches=icons.map(icon=>({icon,confidence:score(stem,normalize(icon))}))
    .sort((a,b)=>b.confidence-a.confidence);
  if(!matches.length||matches[0].confidence<.78) return null;
  if(matches[1] && matches[0].confidence-matches[1].confidence<.07) {
    console.warn('Ambiguous icon for '+rom+'; no icon assigned.');
    return null;
  }
  if (matches[0].confidence<1) console.log('Matched icon:',rom,'→',matches[0].icon);
  return matches[0].icon;
}
const encoded = filename => 'games/'+encodeURIComponent(filename);
const library=roms.map(file=>{
  const icon=iconFor(file);
  return {
    id:'user:'+file.toLowerCase(), // Preserves preexisting save identity.
    name:file.replace(/\.gba$/i,'').replace(/[_]+/g,' ').trim(),
    file:encoded(file),
    icon:icon?encoded(icon):'PokemonEmerald.ico'
  };
});
fs.writeFileSync(path.join(root,'games.json'),JSON.stringify(library,null,2)+'\n');
console.log('GBA game library: generated '+library.length+' game(s).');
