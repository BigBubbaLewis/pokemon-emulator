// Finds supported games in the root or games/ folder before GitHub Pages deployment.
const fs = require('node:fs');
const path = require('node:path');
const consoles = require('./console-support.js');

// Keep the existing automatic icon matching algorithm.
const norm = s => s.replace(/(\))ico$/i,'$1.ico').replace(/\.[^.]+$/,'').toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ')
  .replace(/pok[eé]mon|pokemon|version|gameboy|advance|usa|europe|english|rev\s*\d+/gi,' ')
  .replace(/[^a-z0-9]/g,'');
function dist(a,b){let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[b.length];}
function confidence(a,b){if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length)>=.6?.93:0;return 1-dist(a,b)/Math.max(a.length,b.length);}
const urlPath = file => file.split('/').map(encodeURIComponent).join('/');

function generateLibrary(root = __dirname, log = console) {
  const records = [];
  function scan(relative,recursive) {
    const folder = path.join(root,relative);
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder,{withFileTypes:true})) {
      if (entry.name.startsWith('.') || entry.name === 'bios') continue;
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory() && recursive) scan(file,true);
      else if (entry.isFile()) records.push({file:entry.name,relative:file,path:urlPath(file)});
    }
  }
  scan('',false);
  scan('games',true);
  const icons = records.filter(x => /(?:\.ico|\)ico)$/i.test(x.file));
  function pickIcon(rom) {
    const ranked = icons.map(x => ({x,v:confidence(norm(rom.file),norm(x.file))})).sort((a,b) => b.v-a.v);
    if (!ranked.length || ranked[0].v < .78) return null;
    const local = ranked.filter(x => x.v === 1 && path.dirname(x.x.relative) === path.dirname(rom.relative));
    if (local.length === 1) return local[0].x.path;
    if (ranked[1] && ranked[0].v-ranked[1].v < .07) return null;
    return ranked[0].x.path;
  }
  const companionFiles = new Set();
  const candidates = [];
  const possibleExtensions = new Set(consoles.systems.flatMap(s => s.extensions).concat(consoles.archives));
  for (const rom of records) {
    if (!possibleExtensions.has(consoles.extension(rom.file))) continue;
    const folderHint = rom.relative.split('/').slice(1,-1).find(part => consoles.systemForHint(part));
    const system = consoles.resolveSystem(rom.file,folderHint);
    if (!system) {
      log.warn('Unrecognized or ambiguous console; place the game in games/<console>/:',rom.relative);
      continue;
    }
    const externalFiles = {};
    if (consoles.extension(rom.file) === 'cue') {
      const content = fs.readFileSync(path.join(root,rom.relative),'utf8');
      const references = [...content.matchAll(/^\s*FILE\s+(?:"([^"]+)"|(\S+))\s+\S+/gim)];
      let complete = references.length > 0;
      for (const match of references) {
        const name = (match[1] || match[2]).replace(/\\/g,'/');
        const relative = path.posix.join(path.posix.dirname(rom.relative),name);
        if (name.startsWith('/') || name.split('/').includes('..') || /:/.test(name) ||
            !records.some(record => record.relative === relative)) {
          log.warn('Missing or invalid CUE companion:',name,'for',rom.relative);
          complete = false;
          break;
        }
        externalFiles['/' + name] = urlPath(relative);
        companionFiles.add(relative);
      }
      if (!complete) continue;
    }
    candidates.push({...rom,system,externalFiles});
  }
  const seen = new Set();
  const library = [];
  candidates.sort((a,b) => a.file.localeCompare(b.file) || a.relative.localeCompare(b.relative));
  for (const rom of candidates) {
    if (companionFiles.has(rom.relative)) continue;
    const emerald = rom.file.toLowerCase() === 'pokemonemerald.gba';
    // Preserve existing IDs and save hashes, including Emerald.
    let id = emerald ? 'emerald' : 'user:' + rom.file.toLowerCase();
    if (seen.has(id)) {
      if (rom.system.id === 'gba') {
        log.warn('Duplicate GBA filename skipped to preserve its save ID:',rom.relative);
        continue;
      }
      id = 'user:' + rom.relative.toLowerCase();
    }
    seen.add(id);
    const game = {id,name:emerald ? 'Pokémon Emerald' : rom.file.replace(/\.[^.]+$/,'').replace(/_/g,' ').trim(),
      file:rom.path,icon:pickIcon(rom),system:rom.system.id};
    if (Object.keys(rom.externalFiles).length) game.externalFiles = rom.externalFiles;
    library.push(game);
  }
  fs.writeFileSync(path.join(root,'games.json'),JSON.stringify(library,null,2)+'\n');
  log.log(`Game library: found ${library.length} game(s).`);
  for (const g of library) log.log(' - '+g.name+' ['+g.system+'] ('+g.file+')');
  return library;
}

if (require.main === module) generateLibrary();
module.exports = {generateLibrary};
